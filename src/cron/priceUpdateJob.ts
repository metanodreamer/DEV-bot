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
          const description = `24h: ${changeEmoji}${change24h.toFixed(2)}% || Vol: $${formatNumber(volume24h)}`;

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
 * Initializes and starts the cron jobs for updating the bot's username and activity.
 * @param client The Discord Client instance
 */
export function startDevPriceUpdateJob(client: Client) {
  // Activity/description update every 8 minutes
  const activityCron = "0 */8 * * * *";
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
        `[CronJob-DevPrice] Activity update scheduled every 8 minutes (${timezone}).`,
      );
      // Initial run
      updateDevActivity(client);
    } else {
      logger.error(
        `[CronJob-DevPrice] Invalid cron expression for activity update: ${activityCron}`,
      );
    }
  } catch (error) {
    logger.error("[CronJob-DevPrice] Failed to start cron jobs", {
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
    });
  }
}