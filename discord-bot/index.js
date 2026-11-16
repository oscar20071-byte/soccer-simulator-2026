"use strict";

require("dotenv").config();

const {
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");
const { createClient } = require("@supabase/supabase-js");

const required = [
  "DISCORD_TOKEN",
  "DISCORD_CLIENT_ID",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY"
];
for (const name of required) {
  if (!process.env[name]) throw new Error("Falta la variable de entorno " + name);
}

const {
  DISCORD_TOKEN,
  DISCORD_CLIENT_ID,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
} = process.env;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const communityByGuild = new Map();
const optedOut = new Set();

const commands = [
  new SlashCommandBuilder()
    .setName("configurar-servidor")
    .setDescription("Registra este servidor para activar sus estadísticas."),
  new SlashCommandBuilder()
    .setName("actividad")
    .setDescription("Consulta tus estadísticas de actividad del servidor."),
  new SlashCommandBuilder()
    .setName("ranking")
    .setDescription("Muestra el ranking de actividad del servidor."),
  new SlashCommandBuilder()
    .setName("privacidad")
    .setDescription("Explica qué datos de actividad registra el bot."),
  new SlashCommandBuilder()
    .setName("desactivar-estadisticas")
    .setDescription("Deja de registrar tu actividad futura."),
  new SlashCommandBuilder()
    .setName("activar-estadisticas")
    .setDescription("Vuelve a permitir el registro de tu actividad."),
  new SlashCommandBuilder()
    .setName("borrar-mis-estadisticas")
    .setDescription("Elimina tus estadísticas históricas de este servidor.")
].map(command => command.toJSON());

function preferenceKey(guildId, userId) {
  return guildId + ":" + userId;
}

function isOptedOut(guildId, userId) {
  return optedOut.has(preferenceKey(guildId, userId));
}

function isTrackable(channelId, guild) {
  return Boolean(channelId) && channelId !== guild?.afkChannelId;
}

async function getCommunityId(guildId) {
  if (communityByGuild.has(guildId)) return communityByGuild.get(guildId);

  const { data, error } = await supabase
    .from("discord_guilds")
    .select("community_id")
    .eq("guild_id", guildId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  communityByGuild.set(guildId, data.community_id);
  return data.community_id;
}

async function loadOptOuts(guildId, communityId) {
  const { data, error } = await supabase
    .from("discord_activity_preferences")
    .select("discord_user_id")
    .eq("community_id", communityId)
    .eq("enabled", false);
  if (error) throw error;

  for (const row of data || []) {
    optedOut.add(preferenceKey(guildId, row.discord_user_id));
  }
}

async function startVoice(guildId, communityId, userId, channelId) {
  const { error } = await supabase.rpc("start_discord_voice_session", {
    p_community_id: communityId,
    p_guild_id: guildId,
    p_discord_user_id: userId,
    p_channel_id: channelId
  });
  if (error) throw error;
}

async function finishVoice(guildId, userId) {
  const { error } = await supabase.rpc("finish_discord_voice_session", {
    p_guild_id: guildId,
    p_discord_user_id: userId,
    p_ended_at: new Date().toISOString()
  });
  if (error) throw error;
}

async function recordMessage(guildId, communityId, userId) {
  const { error } = await supabase.rpc("record_discord_message", {
    p_community_id: communityId,
    p_discord_user_id: userId,
    p_activity_date: new Date().toISOString().slice(0, 10)
  });
  if (error) throw error;
}

client.once(Events.ClientReady, async readyClient => {
  try {
    const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
    await rest.put(
      Routes.applicationCommands(DISCORD_CLIENT_ID),
      { body: commands }
    );
    console.log("Comandos globales de Discord registrados.");

    const { data, error } = await supabase
      .from("discord_guilds")
      .select("guild_id,community_id");
    if (error) throw error;

    for (const row of data || []) {
      communityByGuild.set(row.guild_id, row.community_id);
      await loadOptOuts(row.guild_id, row.community_id);

      // Reset open voice sessions after a restart so bot downtime is not
      // incorrectly counted as time spent in voice.
      const guild = await client.guilds.fetch(row.guild_id);
      const { data: sessions, error: sessionsError } = await supabase
        .from("discord_voice_sessions")
        .select("discord_user_id")
        .eq("guild_id", row.guild_id);
      if (sessionsError) throw sessionsError;

      for (const session of sessions || []) {
        const voiceState = guild.voiceStates.cache.get(session.discord_user_id);
        if (!isOptedOut(row.guild_id, session.discord_user_id) &&
            isTrackable(voiceState?.channelId, guild)) {
          const { error: resetError } = await supabase
            .from("discord_voice_sessions")
            .update({
              channel_id: voiceState.channelId,
              joined_at: new Date().toISOString()
            })
            .eq("guild_id", row.guild_id)
            .eq("discord_user_id", session.discord_user_id);
          if (resetError) throw resetError;
        } else {
          const { error: deleteError } = await supabase
            .from("discord_voice_sessions")
            .delete()
            .eq("guild_id", row.guild_id)
            .eq("discord_user_id", session.discord_user_id);
          if (deleteError) throw deleteError;
        }
      }

      for (const voiceState of guild.voiceStates.cache.values()) {
        if (!isOptedOut(row.guild_id, voiceState.id) &&
            isTrackable(voiceState.channelId, guild)) {
          await startVoice(row.guild_id, row.community_id, voiceState.id, voiceState.channelId);
        }
      }
    }

    console.log(
      "Bot conectado como " + readyClient.user.tag +
      ". Servidores configurados: " + communityByGuild.size
    );
  } catch (error) {
    console.error("No se pudo completar la inicialización:", error.message);
  }
});

client.on(Events.MessageCreate, async message => {
  if (!message.guild || message.author.bot ||
      isOptedOut(message.guild.id, message.author.id)) return;

  try {
    const communityId = await getCommunityId(message.guild.id);
    if (!communityId) return;
    await recordMessage(message.guild.id, communityId, message.author.id);
  } catch (error) {
    console.error("No se pudo registrar actividad de mensaje:", error.message);
  }
});

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  const guild = newState.guild;
  const guildId = guild.id;
  const userId = newState.id;
  if (oldState.channelId === newState.channelId ||
      isOptedOut(guildId, userId)) return;

  try {
    const communityId = await getCommunityId(guildId);
    if (!communityId) return;

    if (oldState.channelId) await finishVoice(guildId, userId);
    if (isTrackable(newState.channelId, guild)) {
      await startVoice(guildId, communityId, userId, newState.channelId);
    }
  } catch (error) {
    console.error("No se pudo actualizar tiempo de voz:", error.message);
  }
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand() || !interaction.inGuild()) return;

  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  try {
    console.log("DEBUG servidor:", {
  guildId: interaction.guildId,
  guildDisponible: Boolean(interaction.guild),
  guildEnCache: client.guilds.cache.has(interaction.guildId)
});

const guild = interaction.guild;

if (!guild) {
  throw new Error("La interacción no contiene información del servidor.");
}

    if (interaction.commandName === "configurar-servidor") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          flags: MessageFlags.Ephemeral,
          content: "Solo un administrador del servidor puede ejecutar esta configuración."
        });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const { data, error } = await supabase.rpc("register_discord_guild", {
        p_guild_id: guildId,
        p_guild_name: guild.name,
        p_configured_by: userId
      });
      if (error) throw error;

      const communityId = data;
      communityByGuild.set(guildId, communityId);
      await loadOptOuts(guildId, communityId);

      return interaction.editReply(
        "Este servidor quedó configurado correctamente. Sus estadísticas estarán separadas de las de otros servidores."
      );
    }

    const communityId = await getCommunityId(guildId);
    if (!communityId) {
      return interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: "Este servidor todavía no está configurado. Un administrador debe ejecutar /configurar-servidor."
      });
    }

    if (interaction.commandName === "privacidad") {
      return interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: "El bot guarda tu ID de Discord, el número de mensajes por día y los minutos acumulados en canales de voz. No guarda textos, archivos, enlaces, mensajes privados ni el contenido de conversaciones. Puedes desactivar el registro con /desactivar-estadisticas o borrar tus datos con /borrar-mis-estadisticas."
      });
    }

    if (interaction.commandName === "desactivar-estadisticas") {
      optedOut.add(preferenceKey(guildId, userId));
      await finishVoice(guildId, userId);
      const { error } = await supabase.from("discord_activity_preferences").upsert({
        community_id: communityId,
        discord_user_id: userId,
        enabled: false,
        updated_at: new Date().toISOString()
      });
      if (error) throw error;
      return interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: "El registro de tu actividad futura está desactivado. Las estadísticas anteriores se conservan."
      });
    }

    if (interaction.commandName === "activar-estadisticas") {
      const { error } = await supabase.from("discord_activity_preferences").upsert({
        community_id: communityId,
        discord_user_id: userId,
        enabled: true,
        updated_at: new Date().toISOString()
      });
      if (error) throw error;
      optedOut.delete(preferenceKey(guildId, userId));

      const voiceState = guild.voiceStates.cache.get(userId);
      if (isTrackable(voiceState?.channelId, guild)) {
        await startVoice(guildId, communityId, userId, voiceState.channelId);
      }
      return interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: "El registro de actividad está activado de nuevo."
      });
    }

    if (interaction.commandName === "borrar-mis-estadisticas") {
      optedOut.add(preferenceKey(guildId, userId));

      const { error: sessionDeleteError } = await supabase
        .from("discord_voice_sessions")
        .delete()
        .eq("guild_id", guildId)
        .eq("discord_user_id", userId);
      if (sessionDeleteError) throw sessionDeleteError;

      const { error: deleteError } = await supabase
        .from("discord_activity_daily")
        .delete()
        .eq("community_id", communityId)
        .eq("discord_user_id", userId);
      if (deleteError) throw deleteError;

      const { error: preferenceError } = await supabase
        .from("discord_activity_preferences")
        .upsert({
          community_id: communityId,
          discord_user_id: userId,
          enabled: false,
          updated_at: new Date().toISOString()
        });
      if (preferenceError) throw preferenceError;

      return interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: "Tus estadísticas históricas fueron eliminadas y el registro futuro quedó desactivado. Puedes volver a activarlo con /activar-estadisticas."
      });
    }

    if (interaction.commandName === "actividad") {
      const { data, error } = await supabase
        .from("discord_activity_daily")
        .select("message_count,voice_minutes")
        .eq("community_id", communityId)
        .eq("discord_user_id", userId)
        .limit(1000);
      if (error) throw error;

      const totals = (data || []).reduce((sum, row) => ({
        messages: sum.messages + row.message_count,
        minutes: sum.minutes + row.voice_minutes
      }), { messages: 0, minutes: 0 });

      return interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: "**Tus estadísticas de Discord**\nMensajes contabilizados: **" +
          totals.messages + "**\nTiempo en voz: **" +
          Math.floor(totals.minutes / 60) + " h " + (totals.minutes % 60) + " min**"
      });
    }

    if (interaction.commandName === "ranking") {
      const { data, error } = await supabase
        .from("discord_activity_daily")
        .select("discord_user_id,message_count,voice_minutes")
        .eq("community_id", communityId)
        .limit(5000);
      if (error) throw error;

      const totals = new Map();
      for (const row of data || []) {
        const item = totals.get(row.discord_user_id) || { messages: 0, minutes: 0 };
        item.messages += row.message_count;
        item.minutes += row.voice_minutes;
        totals.set(row.discord_user_id, item);
      }

      const top = [...totals.entries()]
        .sort((a, b) => b[1].messages - a[1].messages)
        .slice(0, 10);
      if (!top.length) {
        return interaction.reply("Todavía no hay estadísticas registradas.");
      }

      const lines = top.map(([id, stats], index) =>
        (index + 1) + ". **<@" + id + ">** — " + stats.messages +
        " mensajes · " + stats.minutes + " min en voz"
      );
      return interaction.reply({
        content: "**Ranking de actividad**\n" + lines.join("\n")
      });
    }
  } catch (error) {
    console.error("Error al procesar comando:", error.message);
    const response = {
      flags: MessageFlags.Ephemeral,
      content: "No se pudo completar la operación. Revisa la configuración del bot."
    };
    if (interaction.replied || interaction.deferred) {
      return interaction.followUp(response);
    }
    return interaction.reply(response);
  }
});

client.on(Events.Error, error => {
  console.error("Error de Discord:", error.message);
});

client.login(DISCORD_TOKEN);
