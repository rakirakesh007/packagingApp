import { Request, Response } from 'express';
import mongoose, { ClientSession } from 'mongoose';

import { InventoryModel } from '../models/inventory.model';
import { SaleModel } from '../models/sale.model';

type CreateSaleItemInput = {
  item_id: string;
  qty: number;
};

type CreateSaleBody = {
  delivery_boy_id: string;
  items: CreateSaleItemInput[];
  total_amount: number;
  timestamp?: string;
};

const validateCreateSaleBody = (body: Partial<CreateSaleBody>): string | null => {
  if (!body.delivery_boy_id) {
    return 'delivery_boy_id is required.';
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return 'items must be a non-empty array.';
  }

  if (typeof body.total_amount !== 'number' || body.total_amount < 0) {
    return 'total_amount must be a number greater than or equal to 0.';
  }

  for (const item of body.items) {
    if (!item.item_id || !mongoose.isValidObjectId(item.item_id)) {
      return 'Each item must include a valid item_id.';
    }

    if (!Number.isInteger(item.qty) || item.qty <= 0) {
      return 'Each item qty must be a positive integer.';
    }
  }

  if (!mongoose.isValidObjectId(body.delivery_boy_id)) {
    return 'delivery_boy_id must be a valid MongoDB ObjectId.';
  }

  if (body.timestamp && Number.isNaN(Date.parse(body.timestamp))) {
    return 'timestamp must be a valid ISO date string if provided.';
  }

  return null;
};

const reduceInventoryStockAtomically = async (
  session: ClientSession,
  items: CreateSaleItemInput[],
): Promise<void> => {
  for (const item of items) {
    const stockUpdateResult = await InventoryModel.updateOne(
      {
        _id: item.item_id,
        total_stock: { $gte: item.qty },
      },
      {
        $inc: { total_stock: -item.qty },
      },
      {
        session,
      },
    );

    if (stockUpdateResult.modifiedCount !== 1) {
      throw new Error(`Insufficient stock or invalid item for inventory id: ${item.item_id}`);
    }
  }
};

export const createSale = async (req: Request, res: Response): Promise<Response> => {
  const body = req.body as Partial<CreateSaleBody>;
  const validationError = validateCreateSaleBody(body);

  if (validationError) {
    return res.status(400).json({
      success: false,
      message: validationError,
    });
  }

  const session = await mongoose.startSession();

  try {
    let createdSaleId: mongoose.Types.ObjectId | null = null;

    await session.withTransaction(async () => {
      await reduceInventoryStockAtomically(session, body.items as CreateSaleItemInput[]);

      const [createdSale] = await SaleModel.create(
        [
          {
            delivery_boy_id: body.delivery_boy_id,
            items: body.items,
            total_amount: body.total_amount,
            timestamp: body.timestamp ? new Date(body.timestamp) : new Date(),
          },
        ],
        { session },
      );

      createdSaleId = createdSale._id;
    });

    return res.status(201).json({
      success: true,
      message: 'Sale recorded and stock updated successfully.',
      sale_id: createdSaleId,
    });
  } catch (error) {
    return res.status(409).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create sale.',
    });
  } finally {
    await session.endSession();
  }
};
