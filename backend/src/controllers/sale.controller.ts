import { Request, Response } from 'express';
import mongoose, { ClientSession } from 'mongoose';

import { InventoryModel } from '../models/inventory.model';
import { SaleModel } from '../models/sale.model';

type CreateSaleItemInput = {
  item_id: string;
  sheets_sold: number;
  discount_amount?: number;
  item_name?: string;
  hindi_name?: string;
  description?: string;
};

type CreateSaleBody = {
  delivery_boy_id: string;
  items: CreateSaleItemInput[];
  timestamp?: string;
  payment_mode?: string;
};

const validateCreateSaleBody = (body: Partial<CreateSaleBody>): string | null => {
  if (!body.delivery_boy_id) {
    return 'delivery_boy_id is required.';
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return 'items must be a non-empty array.';
  }

  // total_amount is now computed server-side from items; no validation needed here

  for (const item of body.items) {
    if (!item.item_id || !mongoose.isValidObjectId(item.item_id)) {
      return 'Each item must include a valid item_id.';
    }

    if (!Number.isInteger(item.sheets_sold) || item.sheets_sold <= 0) {
      return 'Each item sheets_sold must be a positive integer.';
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
    // Guard: available_stock = total_stock − reserved_stock must cover sheets_sold.
    // Decrement both:
    //   total_stock    − item was sold; permanently leaves warehouse count.
    //   reserved_stock − reservation consumed by the sale.
    const stockUpdateResult = await InventoryModel.updateOne(
      {
        _id: item.item_id,
        $expr: { $gte: [{ $subtract: ['$total_stock', '$reserved_stock'] }, item.sheets_sold] },
      },
      {
        $inc: { total_stock: -item.sheets_sold, reserved_stock: -item.sheets_sold },
      },
      { session },
    );

    if (stockUpdateResult.modifiedCount !== 1) {
      throw new Error(`Insufficient available stock for inventory id: ${item.item_id}`);
    }
  }
};

const buildSaleItems = async (items: CreateSaleItemInput[]): Promise<Array<{
  item_id: string; sheets_sold: number; wholesale_price_per_sheet: number;
  discount_amount: number; final_price: number; profit: number;
  item_name: string; hindi_name: string; description: string;
}>> => {
  const inventoryDocs = await InventoryModel.find({
    _id: { $in: items.map((item) => item.item_id) },
  }).lean();
  const inventoryMap = new Map(inventoryDocs.map((doc) => [String(doc._id), doc]));

  return items.map((item) => {
    const inv = inventoryMap.get(item.item_id);
    const wholesale      = inv?.wholesale_price_per_sheet ?? 0;
    const discount       = item.discount_amount ?? 0;
    const finalPerSheet  = Math.max(0, wholesale - discount);
    return {
      item_id:                   item.item_id,
      sheets_sold:               item.sheets_sold,
      wholesale_price_per_sheet: wholesale,
      discount_amount:           discount,
      final_price:               finalPerSheet * item.sheets_sold,
      profit:                    finalPerSheet * 0.10 * item.sheets_sold,
      item_name:                 inv?.item_name  ?? item.item_name  ?? '',
      hindi_name:                inv?.hindi_name ?? item.hindi_name ?? '',
      description:               inv?.description ?? item.description ?? '',
    };
  });
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
      const saleItems = await buildSaleItems(body.items as CreateSaleItemInput[]);

      const total_amount   = saleItems.reduce((sum, i) => sum + i.final_price, 0);
      const total_discount = saleItems.reduce((sum, i) => sum + i.discount_amount * i.sheets_sold, 0);
      const total_profit   = saleItems.reduce((sum, i) => sum + i.profit, 0);

      const [createdSale] = await SaleModel.create(
        [
          {
            delivery_boy_id: body.delivery_boy_id,
            items: saleItems,
            total_amount,
            total_discount,
            total_profit,
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
