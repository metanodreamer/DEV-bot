import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ApplicationCommandDataResolvable,
} from "discord.js";
import logger from "./utils/logger";
import { startDevPriceUpdateJob } from "./cron/priceUpdateJob";
import { fetchTokenPrice } from "./utils/coinGecko";

const token: string | undefined = process.env.DISCORD_TOKEN;

// Check if the token is set
if (!token) {
  logger.error("Error: DISCORD_TOKEN is not set in the .env file.");
  logger.info(
    "Please create a .env file in the root directory and add your bot token as DISCORD_TOKEN=your_token_here.",
  );
  logger.info(
    "You can also set a BOT_PREFIX in the .env file (e.g., BOT_PREFIX=?)",
  );
  process.exit(1);
}

// Define command data
const commandsData: ApplicationCommandDataResolvable[] = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Replies with Pong!")
    .toJSON(),
  new SlashCommandBuilder()
    .setName("price")
    .setDescription("Fetches and displays the current DEV token price.")
    .toJSON(),
];

async function createDiscordServer(): Promise<Client> {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
    ],
    partials: [Partials.Channel, Partials.Message],
  });

  await client.login(token!);
  return client;
}

async function handleInteractionCommands(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  if (commandName === "ping") {
    await interaction.reply("Pong!");
  }
  else if (commandName === "price") {    
    const tokenData = await fetchTokenPrice("scout-protocol-token");

    if (tokenData) {
      const price = tokenData.usd;
      const replyMessage = `**DEV Token Price:** $${price.toFixed(5)}\n`;                           
      await interaction.reply(replyMessage);
    } else {
      await interaction.reply("Sorry, I couldn't fetch the price right now. Please try again later.");
    }
  }
}

/**
 * Initializes and starts all cron jobs for the application.
 * @param client The Discord Client instance
 */
function initializeCronJobs(client: Client): void {
  logger.info("Initializing cron jobs...");
  startDevPriceUpdateJob(client);
  logger.info("Cron jobs initialized.");
}

async function main(): Promise<void> {
  try {
    const client = await createDiscordServer();

    if (!client.user) {
      logger.error("Client user is not available after login.");
      process.exit(1);
    }

    logger.info("Started bot successfully", { tag: client.user.tag });

    const rest = new REST({ version: "10" }).setToken(token!);

    // Fetch existing application commands
    // The REST get operation returns an array of unknown and needs to be cast.
    // We are interested in objects that have at least an id and a name.
    const existingCommands = (await rest.get(
      Routes.applicationCommands(client.user.id),
    )) as { id: string; name: string }[];

    // Commands to delete
    const commandsToDelete = existingCommands.filter(
      (command) =>
        !commandsData.some(
          (data) => "name" in data && data.name === command.name,
        ),
    );

    for (const command of commandsToDelete) {
      await rest.delete(Routes.applicationCommand(client.user.id, command.id));
      logger.info("Deleted unused command", { command: command.name });
    }

    // Commands to create/update (simplified: just create new ones)
    // For a full update, one might compare more properties or use PUT requests for individual commands
    const newCommandsToRegister = commandsData.filter(
      (data) =>
        "name" in data && !existingCommands.some((c) => c.name === data.name),
    );

    if (newCommandsToRegister.length > 0) {
      logger.info("Registering new slash commands...");
      await rest.put(
        Routes.applicationCommands(client.user.id),
        { body: commandsData }, // We can send all commandsData; Discord API handles updates/creations.
        // Or, send only newCommandsToRegister for more granular control as in the example.
        // For simplicity here, sending all.
      );
      newCommandsToRegister.forEach((command) => {
        if ("name" in command) {
          logger.info("Slash command created/updated", {
            command: command.name,
          });
        }
      });
    }

    client.on("interactionCreate", async (interaction) => {
      if (interaction.isChatInputCommand()) {
        await handleInteractionCommands(interaction);
      }
    });

    logger.info(`Ready! Logged in as ${client.user.tag}`);

    initializeCronJobs(client);
  } catch (error) {
    logger.error("Detailed error starting bot:", error);
    console.error("[CONSOLE] Detailed error starting bot:", error);
    process.exit(1);
  }
}

logger.info("Bot is starting...");
main();
