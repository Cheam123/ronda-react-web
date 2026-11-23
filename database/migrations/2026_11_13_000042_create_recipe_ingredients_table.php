<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * What goes into one serve of a drink. `quantity` is in the product's own
     * unit (0.018 of a kg), for cost per serve; `amount_label` is how a person
     * reads it ("18 g").
     */
    public function up()
    {
        Schema::create('recipe_ingredients', function (Blueprint $table) {
            $table->id();
            $table->foreignId('recipe_id')->constrained('recipes')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products');
            $table->decimal('quantity', 10, 4)->comment("Per serve, in the product's unit");
            $table->string('amount_label', 40)->nullable();
            $table->unsignedSmallInteger('sort')->default(0);
            $table->timestamps();

            $table->unique(['recipe_id', 'product_id']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('recipe_ingredients');
    }
};
