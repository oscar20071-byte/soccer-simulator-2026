"use strict";

require("dotenv").config();

const {
  Client,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");
const { createClient } = require("@supabase/supabase-js");

const required = [
  "DISCORD_TOKEN",
  "DISCORD_CLIENT_ID",
  "DISCORD_GUILD_ID",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "COMMUNITY_ID"
];
for (const name of required) {
  if (!process.env[name]) throw new Error("Falta la variable de entorno " + name);
}

const {
  DISCORD_TOKEN,
  DISCORD_CLIENT_ID,
  DISCORD_GUILD_ID,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  COMMUNITY_ID,
  DISCORD_AFK_CHANNEL_ID
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

const optedOut = new Set();

const commands = [
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

function isTrackable(channelId) {
  return Boolean(channelId) && channelId !== DISCORD_AFK_CHANNEL_ID;
}

async function startVoice(userId, channelId) {
  const { error } = await supabase.rpc("start_discord_voice_session", {
    p_community_id: COMMUNITY_ID,
    p_guild_id: DISCORD_GUILD_ID,
    p_discord_user_id: userId,
    p_channel_id: channelId
  });
  if (error) throw error;
}

async function finishVoice(userId) {
  const { error } = await supabase.rpc("finish_discord_voice_session", {
    p_guild_id: DISCORD_GUILD_ID,
    p_discord_user_id: userId,
    p_ended_at: new Date().toISOString()
  });
  if (error) throw error;
}

client.once(Events.ClientReady, async readyClient => {
  try {
    const { data, error } = await supabase
      .from("discord_activity_preferences")
      .select("discord_user_id")
      .eq("community_id", COMMUNITY_ID)
      .eq("enabled", false);
    if (error) throw error;
    for (const row of data || []) optedOut.add(row.discord_user_id);

    // Reconcile voice sessions after a restart so stale sessions are closed
    // and members currently in voice can continue being measured.
    const guild = await client.guilds.fetch(DISCORD_GUILD_ID);
    const { data: openSessions, error: sessionsError } = await supabase
      .from("discord_voice_sessions")
      .select("discord_user_id")
      .eq("guild_id", DISCORD_GUILD_ID);
    if (sessionsError) throw sessionsError;

    for (const session of openSessions || []) {
      const voiceState = guild.voiceStates.cache.get(session.discord_user_id);
      if (optedOut.has(session.discord_user_id) ||
          !voiceState || !isTrackable(voiceState.channelId)) {
        await finishVoice(session.discord_user_id);
      } else {
        await startVoice(session.discord_user_id, voiceState.channelId);
      }
    }

    for (const voiceState of guild.voiceStates.cache.values()) {
      if (!optedOut.has(voiceState.id) && isTrackable(voiceState.channelId)) {
        await startVoice(voiceState.id, voiceState.channelId);
      }
    }

    const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
    await rest.put(
      Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID),
      { body: commands }
    );
    console.log("Bot de estadísticas conectado como " + readyClient.user.tag);
  } catch (error) {
    console.error("No se pudo iniciar el módulo de estadísticas:", error.message);
  }
});

client.on(Events.MessageCreate, async message => {
  if (!message.guild || message.guild.id !== DISCORD_GUILD_ID ||
      message.author.bot || optedOut.has(message.author.id)) return;

  try {
    const { error } = await supabase.rpc("record_discord_message", {
      p_community_id: COMMUNITY_ID,
      p_discord_user_id: message.author.id,
      p_activity_date: new Date().toISOString().slice(0, 10)
    });
    if (error) throw error;
  } catch (error) {
    console.error("No se pudo registrar actividad de mensaje:", error.message);
  }
});

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  if (newState.guild.id !== DISCORD_GUILD_ID) return;
  const userId = newState.id;
  if (oldState.channelId === newState.channelId) return;

  try {
    if (oldState.channelId && !optedOut.has(userId)) {
      await finishVoice(userId);
    }
    if (isTrackable(newState.channelId) && !optedOut.has(userId)) {
      await startVoice(userId, newState.channelId);
    }
  } catch (error) {
    console.error("No se pudo actualizar tiempo de voz:", error.message);
  }
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand() || interaction.guildId !== DISCORD_GUILD_ID) return;
  const userId = interaction.user.id;

  try {
    if (interaction.commandName === "privacidad") {
      return interaction.reply({
        ephemeral: true,
        content: "El bot guarda tu ID de Discord, el número de mensajes por día y los minutos acumulados en canales de voz. No guarda textos, archivos, enlaces, mensajes privados ni el contenido de conversaciones. Puedes desactivar el registro con /desactivar-estadisticas o borrar tus datos con /borrar-mis-estadisticas."
      });
    }

    if (interaction.commandName === "desactivar-estadisticas") {
      optedOut.add(userId);
      await finishVoice(userId);
      const { error } = await supabase.from("discord_activity_preferences").upsert({
        community_id: COMMUNITY_ID,
        discord_user_id: userId,
        enabled: false,
        updated_at: new Date().toISOString()
      });
      if (error) throw error;
      return interaction.reply({
        ephemeral: true,
        content: "El registro de tu actividad futura está desactivado. Las estadísticas anteriores se conservan."
      });
    }

    if (interaction.commandName === "activar-estadisticas") {
      const { error } = await supabase.from("discord_activity_preferences").upsert({
        community_id: COMMUNITY_ID,
        discord_user_id: userId,
        enabled: true,
        updated_at: new Date().toISOString()
      });
      if (error) throw error;
      optedOut.delete(userId);
      const voiceState = interaction.guild.voiceStates.cache.get(userId);
      if (isTrackable(voiceState?.channelId)) {
        await startVoice(userId, voiceState.channelId);
      }
      return interaction.reply({
        ephemeral: true,
        content: "El registro de actividad está activado de nuevo."
      });
    }

    if (interaction.commandName === "borrar-mis-estadisticas") {
      optedOut.add(userId);
      const { error: sessionDeleteError } = await supabase
        .from("discord_voice_sessions")
        .delete()
        .eq("guild_id", DISCORD_GUILD_ID)
        .eq("discord_user_id", userId);
      if (sessionDeleteError) throw sessionDeleteError;
      const { error: deleteError } = await supabase
        .from("discord_activity_daily")
        .delete()
        .eq("community_id", COMMUNITY_ID)
        .eq("discord_user_id", userId);
      if (deleteError) throw deleteError;
      const { error: preferenceError } = await supabase
        .from("discord_activity_preferences")
        .upsert({
          community_id: COMMUNITY_ID,
          discord_user_id: userId,
          enabled: false,
          updated_at: new Date().toISOString()
        });
      if (preferenceError) throw preferenceError;
      return interaction.reply({
        ephemeral: true,
        content: "Tus estadísticas históricas fueron eliminadas y el registro futuro quedó desactivado. Puedes volver a activarlo con /activar-estadisticas."
      });
    }

    if (interaction.commandName === "actividad") {
      const { data, error } = await supabase
        .from("discord_activity_daily")
        .select("message_count,voice_minutes")
        .eq("community_id", COMMUNITY_ID)
        .eq("discord_user_id", userId)
        .limit(1000);
      if (error) throw error;
      const totals = (data || []).reduce((sum, row) => ({
        messages: sum.messages + row.message_count,
        minutes: sum.minutes + row.voice_minutes
      }), { messages: 0, minutes: 0 });
      const hours = Math.floor(totals.minutes / 60);
      const minutes = totals.minutes % 60;
      return interaction.reply({
        ephemeral: true,
        content: "**Tus estadísticas de Discord**\nMensajes contabilizados: **" +
          totals.messages + "**\nTiempo en voz: **" + hours + " h " + minutes + " min**"
      });
    }

    if (interaction.commandName === "ranking") {
      const { data, error } = await supabase
        .from("discord_activity_daily")
        .select("discord_user_id,message_count,voice_minutes")
        .eq("community_id", COMMUNITY_ID)
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
      const lines = await Promise.all(top.map(async ([id, stats], index) => {
        const name = "<@" + id + ">";
        return (index + 1) + ". **" + name + "** — " + stats.messages +
          " mensajes · " + stats.minutes + " min en voz";
      }));
      return interaction.reply({
        content: "**Ranking de actividad**\n" + lines.join("\n")
      });
    }
  } catch (error) {
    console.error("Error al procesar comando:", error.message);
    const response = {
      ephemeral: true,
      content: "No se pudo consultar o actualizar la actividad. Revisa la configuración del bot."
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
