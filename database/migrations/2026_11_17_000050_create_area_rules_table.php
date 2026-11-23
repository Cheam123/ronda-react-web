<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * For each area type, the kinds of drink and the price levels that suit
     * it. Admins edit them on Admin -> Drinks -> Area rules; the menu ranking
     * reads them for the Area part of an idea's score.
     */
    public function up()
    {
        Schema::create('area_rules', function (Blueprint $table) {
            $table->id();
            $table->string('kind', 20)->unique()->comment('Area type, a key of ife.recommendation.area.area_labels');
            $table->json('categories')->nullable()->comment('Recipe::CATEGORIES keys that suit it; empty = any');
            $table->json('price_tiers')->nullable()->comment('Recipe::PRICE_TIERS keys that suit it; empty = any');
            $table->string('note', 200)->nullable()->comment('What the area is like, in words');
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('area_rules');
    }
};
