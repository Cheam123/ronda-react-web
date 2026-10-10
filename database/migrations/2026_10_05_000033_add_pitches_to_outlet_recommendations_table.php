<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * "How to pitch" tips per suggested product: written the first time a rep
     * opens one, then cached until the suggested items change, like the
     * "Why these?" explanation.
     */
    public function up()
    {
        Schema::table('outlet_recommendations', function (Blueprint $table) {
            $table->json('pitches')->nullable()->after('explained_hash')->comment('sku => {pitch, objection, reply}');
            $table->string('pitches_source', 20)->nullable()->after('pitches')->comment('bedrock | template');
            $table->string('pitched_hash', 64)->nullable()->after('pitches_source')->comment('items_hash the pitches were written for');
        });
    }

    public function down()
    {
        Schema::table('outlet_recommendations', function (Blueprint $table) {
            $table->dropColumn(['pitches', 'pitches_source', 'pitched_hash']);
        });
    }
};
