<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Drinks an outlet could make from catalogue products. The engine suggests
     * a drink, then the products the outlet is missing to make it.
     */
    public function up()
    {
        Schema::create('recipes', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120);
            $table->string('slug', 140)->unique()->comment('Stable key; also the tie-break when two drinks score the same');
            $table->text('description')->nullable();
            $table->string('serve', 10)->default('either')->comment('hot | iced | either');
            $table->json('outlet_types')->nullable()->comment('Business category ids; empty means any');
            $table->json('customer_groups')->nullable()->comment('Area kinds from ife.recommendation.customer_groups; empty means any');
            $table->string('price_tier', 20)->nullable()->comment('budget | mid_range | premium; null means any');
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('recipes');
    }
};
