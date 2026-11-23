<?php

namespace App\Services;

use App\Models\Leads;
use App\Models\Order;
use App\Models\OrderLine;
use App\Models\Product;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Records and cancels outlet orders, for the web and the mobile app alike.
 * Prices come from the catalogue at the time of the order, never from the
 * client, and the total is always the sum of the lines.
 */
class OrderService
{
    public const MAX_QUANTITY = 100000;

    /**
     * @param array  $lines     list of ['product_id' => int, 'quantity' => number, 'suggested' => ?bool]
     *                          suggested: the line was pre-filled from a suggestion
     * @param string $orderDate Y-m-d, default today; may not be in the future
     * @throws ValidationException keyed "lines", "lines.N.product_id", "lines.N.quantity", "order_date"
     */
    public function record(Leads $lead, User $user, array $lines, ?string $orderDate = null, ?string $remark = null): Order
    {
        $errors = [];

        try {
            $date = $orderDate ? Carbon::parse($orderDate)->startOfDay() : Carbon::today();
            if ($date->isAfter(Carbon::today())) {
                $errors['order_date'] = 'The order date cannot be in the future.';
            }
        } catch (\Throwable $e) {
            $date                 = Carbon::today();
            $errors['order_date'] = 'The order date is not a valid date.';
        }

        $productIds = array_filter(array_map(fn ($line) => (int) ($line['product_id'] ?? 0), array_values($lines)));
        $products   = Product::active()->whereIn('id', $productIds)->get()->keyBy('id');
        $quantities = [];
        $suggested  = [];

        foreach (array_values($lines) as $index => $line) {
            $productId = (int) ($line['product_id'] ?? 0);
            $quantity  = $line['quantity'] ?? null;

            if (!$products->has($productId)) {
                $errors["lines.{$index}.product_id"] = 'Choose an active product.';
                continue;
            }
            if (!is_numeric($quantity) || (float) $quantity <= 0 || (float) $quantity > self::MAX_QUANTITY) {
                $errors["lines.{$index}.quantity"] = 'Enter a quantity greater than 0.';
                continue;
            }

            // The same product twice is one line with the quantities added.
            $quantities[$productId] = ($quantities[$productId] ?? 0) + round((float) $quantity, 2);

            if (filter_var($line['suggested'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
                $suggested[$productId] = true;
            }
        }

        if (empty($quantities) && empty($errors)) {
            $errors['lines'] = 'Add at least one product.';
        }

        if (!empty($errors)) {
            throw ValidationException::withMessages($errors);
        }

        $order = DB::transaction(function () use ($lead, $user, $date, $remark, $quantities, $products, $suggested) {
            $order = Order::create([
                'lead_id'      => $lead->id,
                'order_date'   => $date->toDateString(),
                'created_by'   => $user->id,
                'status'       => Order::STATUS_CONFIRMED,
                'total_amount' => 0,
                'remark'       => $remark !== null && trim($remark) !== '' ? trim($remark) : null,
            ]);

            $total = 0.0;
            foreach ($quantities as $productId => $quantity) {
                $price     = (float) $products[$productId]->unit_price;
                $lineTotal = round($quantity * $price, 2);
                $total    += $lineTotal;

                OrderLine::create([
                    'order_id'   => $order->id,
                    'product_id' => $productId,
                    'quantity'   => $quantity,
                    'unit_price' => $price,
                    'line_total' => $lineTotal,
                    'suggested'  => isset($suggested[$productId]),
                ]);
            }

            $order->order_no     = sprintf('ORD-%06d', $order->id);
            $order->total_amount = round($total, 2);
            $order->save();

            return $order;
        });

        return $order->load(['lines.product', 'createdBy']);
    }

    /** Cancelled orders stay on the history but stop counting as purchases. */
    public function cancel(Order $order): Order
    {
        if (!$order->isCancelled()) {
            $order->update(['status' => Order::STATUS_CANCELLED]);
        }

        return $order;
    }
}
