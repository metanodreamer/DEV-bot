import cron from "node-cron";
import logger from "../utils/logger";
import { Client, ActivityType } from "discord.js";
import { fetchTokenPrice, formatNumber } from "../utils/coinGecko";

// In-memory store for the latest fetched DEV price (Scout Protocol Token).
let latestDevPrice: number | null = null;

/**
 * Updates the bot's activity (description/status) every 5 minutes.
 */
async function updateDevActivity(client: Client) {
  try {
    const tokenData = await fetchTokenPrice("scout-protocol-token");
    if (tokenData) {
      const price = tokenData.usd;
      const volume24h = tokenData.usd_24h_vol || 0;
      const change24h = tokenData.usd_24h_change || 0;
      latestDevPrice = price;
      logger.info(
        `[CronJob-DevPrice] Scout Protocol Token price updated: $${price}`,
      );
      if (client.user) {
        try {
          const title = `DEV $${price.toFixed(5)}`;
          const changeEmoji = change24h >= 0 ? "📈" : "📉";
          const description = `24h: ${changeEmoji}${change24h.toFixed(2)}% | Vol: $${formatNumber(volume24h)}`;
          client.user.setActivity(title, {
            type: ActivityType.Watching,
            state: description,
          });
          logger.info(
            `[CronJob-DevPrice] Bot activity updated - Description: ${description}`,
          );
        } catch (activityError) {
          logger.error("[CronJob-DevPrice] Failed to set bot activity", {
            errorMessage:
              activityError instanceof Error
                ? activityError.message
                : "Unknown error",
            errorStack:
              activityError instanceof Error ? activityError.stack : undefined,
          });
        }
      }
    } else {
      logger.warn(
        "[CronJob-DevPrice] Failed to fetch token price from Coingecko.",
      );
    }
  } catch (error) {
    logger.error("[CronJob-DevPrice] Error in updateDevActivity", {
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
    });
  }
}

/**
 * Updates the bot's username every hour (rate limit safe).
 */
async function updateDevUsername(client: Client) {
  try {
    const tokenData = await fetchTokenPrice("scout-protocol-token");
    if (tokenData && client.user) {
      const price = tokenData.usd;
      const newUsername = `DEV: $${price.toFixed(5)}`;
      if (client.user.username !== newUsername) {
        await client.user.setUsername(newUsername);
        logger.info(
          `[CronJob-DevPrice] Bot username updated to: ${newUsername}`,
        );
      } else {
        logger.info("[CronJob-DevPrice] Username already up-to-date.");
      }
    }
  } catch (error) {
    logger.error("[CronJob-DevPrice] Error updating bot username", {
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
    });
  }
}

/**
 * Initializes and starts the cron jobs for updating the bot's username and activity.
 * @param client The Discord Client instance
 */
export function startDevPriceUpdateJob(client: Client) {
  // Activity/description update every 5 minutes
  const activityCron = "0 */5 * * * *";
  // Username update every hour
  const usernameCron = "0 0 * * * *";
  const timezone = "UTC";

  try {
    if (cron.validate(activityCron)) {
      cron.schedule(
        activityCron,
        () => {
          logger.info("[CronJob-DevPrice] Activity cron triggered.");
          updateDevActivity(client);
        },
        { timezone },
      );
      logger.info(
        `[CronJob-DevPrice] Activity update scheduled every 5 minutes (${timezone}).`,
      );
      // Initial run
      updateDevActivity(client);
    } else {
      logger.error(
        `[CronJob-DevPrice] Invalid cron expression for activity update: ${activityCron}`,
      );
    }
    if (cron.validate(usernameCron)) {
      cron.schedule(
        usernameCron,
        () => {
          logger.info("[CronJob-DevPrice] Username cron triggered.");
          updateDevUsername(client);
        },
        { timezone },
      );
      logger.info(
        `[CronJob-DevPrice] Username update scheduled every hour (${timezone}).`,
      );
      // Initial run
      updateDevUsername(client);
    } else {
      logger.error(
        `[CronJob-DevPrice] Invalid cron expression for username update: ${usernameCron}`,
      );
    }
  } catch (error) {
    logger.error("[CronJob-DevPrice] Failed to start cron jobs", {
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
    });
  }
}

/**
 * Retrieves the latest Scout Protocol Token price fetched by the cron job.
 * @returns The latest price as a number, or null if no price has been fetched yet or an error occurred.
 */
export function getLatestDevPrice(): number | null {
  return latestDevPrice;
}
