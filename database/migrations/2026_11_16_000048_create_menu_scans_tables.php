<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A scan of an outlet's drinks menu: what was read, which drinks it
     * names, and the drink ideas that came out of it. The newest confirmed
     * scan is the outlet's menu; older ones are its history.
     */
    public function up()
    {
        Schema::create('menu_scans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lead_id')->constrained('leads')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users');
            $table->string('source', 10)->comment('phone | typed');
            $table->string('status', 10)->default('draft')->comment('draft until the rep has checked it, then confirmed');
            $table->json('fragments')->comment('The text as it was read, with positions when a phone read it');
            $table->decimal('median_price', 8, 2)->nullable()->comment('Middle price of the drinks on the menu');
            $table->string('price_level', 20)->nullable()->comment('budget | mid_range | premium, from median_price');
            $table->json('ideas')->nullable()->comment('The drink ideas as they were when the scan was confirmed');
            $table->dateTime('confirmed_at')->nullable();
            $table->timestamps();

            $table->index(['lead_id', 'status', 'id']);
        });

        Schema::create('menu_scan_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('menu_scan_id')->constrained('menu_scans')->cascadeOnDelete();
            $table->string('row_text', 255)->comment('The menu row as read');
            $table->unsignedTinyInteger('page')->default(0);
            $table->unsignedSmallInteger('position')->default(0)->comment('Reading order within the scan');
            $table->decimal('price', 8, 2)->nullable();
            $table->string('kind', 15)->comment('matched | unrecognised');
            $table->foreignId('recipe_id')->nullable()->constrained('recipes')->nullOnDelete();
            $table->decimal('match_share', 4, 3)->nullable()->comment('How much of the row the drink name covers');
            $table->boolean('kept')->default(true)->comment('False when the rep said it is not on the menu');
            $table->boolean('changed_by_rep')->default(false);
            $table->timestamps();

            $table->index(['recipe_id', 'kind']);
        });

        Schema::table('document_uploads', function (Blueprint $table) {
            $table->foreignId('menu_scan_id')->nullable()->after('lead_id')->constrained('menu_scans')->nullOnDelete();
        });

        Schema::table('recommendation_feedback', function (Blueprint $table) {
            $table->foreignId('menu_scan_id')->nullable()->after('recipe_id')->constrained('menu_scans')->nullOnDelete();
        });
    }

    public function down()
    {
        Schema::table('recommendation_feedback', fn (Blueprint $table) => $table->dropConstrainedForeignId('menu_scan_id'));
        Schema::table('document_uploads', fn (Blueprint $table) => $table->dropConstrainedForeignId('menu_scan_id'));
        Schema::dropIfExists('menu_scan_items');
        Schema::dropIfExists('menu_scans');
    }
};
