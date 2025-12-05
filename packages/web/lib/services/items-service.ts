/**
 * Items Service
 *
 * CRUD operations for user items - demonstrates typical service patterns
 * TEMPLATE: Use this as a reference for your own service implementations
 */

import { db } from "@/lib/db";
import { userItems, type ItemStatus } from "@/lib/db/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { logger } from "./logger-service";

export interface CreateItemInput {
  userId: string;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  order?: number;
}

export interface UpdateItemInput {
  title?: string;
  description?: string;
  status?: typeof ItemStatus.enumValues[number];
  metadata?: Record<string, unknown>;
  order?: number;
}

export interface GetItemsOptions {
  status?: typeof ItemStatus.enumValues[number];
  limit?: number;
  offset?: number;
  orderBy?: "createdAt" | "updatedAt" | "order" | "title";
  orderDirection?: "asc" | "desc";
}

export class ItemsService {
  /**
   * Create a new item for a user
   */
  static async createItem(input: CreateItemInput) {
    try {
      logger.info("Creating item", { userId: input.userId, title: input.title });

      const [item] = await db
        .insert(userItems)
        .values({
          userId: input.userId,
          title: input.title,
          description: input.description,
          metadata: input.metadata,
          order: input.order ?? 0,
          status: "active",
        })
        .returning();

      logger.info("Item created successfully", { itemId: item.id });
      return item;
    } catch (error) {
      logger.error("Failed to create item", { error, input });
      throw error;
    }
  }

  /**
   * Get a single item by ID
   */
  static async getItem(itemId: string, userId: string) {
    try {
      const [item] = await db
        .select()
        .from(userItems)
        .where(and(eq(userItems.id, itemId), eq(userItems.userId, userId)))
        .limit(1);

      return item || null;
    } catch (error) {
      logger.error("Failed to get item", { error, itemId, userId });
      throw error;
    }
  }

  /**
   * Get all items for a user with optional filtering
   */
  static async getUserItems(userId: string, options: GetItemsOptions = {}) {
    try {
      const {
        status = "active",
        limit = 50,
        offset = 0,
        orderBy = "createdAt",
        orderDirection = "desc",
      } = options;

      logger.info("Fetching user items", { userId, options });

      // Build query conditions
      const conditions = [eq(userItems.userId, userId)];

      if (status) {
        conditions.push(eq(userItems.status, status));
      }

      // Determine order column
      const orderColumn =
        orderBy === "createdAt"
          ? userItems.createdAt
          : orderBy === "updatedAt"
            ? userItems.updatedAt
            : orderBy === "order"
              ? userItems.order
              : userItems.title;

      const orderFn = orderDirection === "asc" ? asc : desc;

      const items = await db
        .select()
        .from(userItems)
        .where(and(...conditions))
        .orderBy(orderFn(orderColumn))
        .limit(limit)
        .offset(offset);

      logger.info("Fetched user items", { userId, count: items.length });
      return items;
    } catch (error) {
      logger.error("Failed to fetch user items", { error, userId, options });
      throw error;
    }
  }

  /**
   * Update an existing item
   */
  static async updateItem(itemId: string, userId: string, input: UpdateItemInput) {
    try {
      logger.info("Updating item", { itemId, userId, input });

      const [updated] = await db
        .update(userItems)
        .set({
          ...input,
          updatedAt: new Date(),
        })
        .where(and(eq(userItems.id, itemId), eq(userItems.userId, userId)))
        .returning();

      if (!updated) {
        throw new Error("Item not found or access denied");
      }

      logger.info("Item updated successfully", { itemId });
      return updated;
    } catch (error) {
      logger.error("Failed to update item", { error, itemId, userId });
      throw error;
    }
  }

  /**
   * Archive an item (soft delete to archived status)
   */
  static async archiveItem(itemId: string, userId: string) {
    try {
      logger.info("Archiving item", { itemId, userId });

      const [archived] = await db
        .update(userItems)
        .set({
          status: "archived",
          archivedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(userItems.id, itemId), eq(userItems.userId, userId)))
        .returning();

      if (!archived) {
        throw new Error("Item not found or access denied");
      }

      logger.info("Item archived successfully", { itemId });
      return archived;
    } catch (error) {
      logger.error("Failed to archive item", { error, itemId, userId });
      throw error;
    }
  }

  /**
   * Delete an item (soft delete to deleted status)
   */
  static async deleteItem(itemId: string, userId: string) {
    try {
      logger.info("Deleting item", { itemId, userId });

      const [deleted] = await db
        .update(userItems)
        .set({
          status: "deleted",
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(userItems.id, itemId), eq(userItems.userId, userId)))
        .returning();

      if (!deleted) {
        throw new Error("Item not found or access denied");
      }

      logger.info("Item deleted successfully", { itemId });
      return deleted;
    } catch (error) {
      logger.error("Failed to delete item", { error, itemId, userId });
      throw error;
    }
  }

  /**
   * Hard delete an item (permanently remove from database)
   * CAUTION: This is irreversible
   */
  static async hardDeleteItem(itemId: string, userId: string) {
    try {
      logger.warn("Hard deleting item", { itemId, userId });

      const [deleted] = await db
        .delete(userItems)
        .where(and(eq(userItems.id, itemId), eq(userItems.userId, userId)))
        .returning();

      if (!deleted) {
        throw new Error("Item not found or access denied");
      }

      logger.info("Item hard deleted successfully", { itemId });
      return deleted;
    } catch (error) {
      logger.error("Failed to hard delete item", { error, itemId, userId });
      throw error;
    }
  }

  /**
   * Count items for a user
   */
  static async countUserItems(
    userId: string,
    status?: typeof ItemStatus.enumValues[number]
  ) {
    try {
      const conditions = [eq(userItems.userId, userId)];

      if (status) {
        conditions.push(eq(userItems.status, status));
      }

      const items = await db.select().from(userItems).where(and(...conditions));

      return items.length;
    } catch (error) {
      logger.error("Failed to count user items", { error, userId, status });
      throw error;
    }
  }

  /**
   * Restore an archived or deleted item
   */
  static async restoreItem(itemId: string, userId: string) {
    try {
      logger.info("Restoring item", { itemId, userId });

      const [restored] = await db
        .update(userItems)
        .set({
          status: "active",
          archivedAt: null,
          deletedAt: null,
          updatedAt: new Date(),
        })
        .where(and(eq(userItems.id, itemId), eq(userItems.userId, userId)))
        .returning();

      if (!restored) {
        throw new Error("Item not found or access denied");
      }

      logger.info("Item restored successfully", { itemId });
      return restored;
    } catch (error) {
      logger.error("Failed to restore item", { error, itemId, userId });
      throw error;
    }
  }
}
