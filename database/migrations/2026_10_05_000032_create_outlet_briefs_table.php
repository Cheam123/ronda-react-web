<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The visit brief on an outlet page: written when a rep asks for it,
     * kept here, and shown as out of date once the outlet's visits, orders,
     * tasks or suggestions change (data_hash no longer matches).
     */
    public function up()
    {
        Schema::create('outlet_briefs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lead_id')->unique()->constrained('leads')->cascadeOnDelete();
            $table->text('content')->comment('Plain text: "Label:" lines with "- " bullets');
            $table->string('source', 20)->comment('bedrock | template');
            $table->string('model', 100)->nullable();
            $table->unsignedInteger('input_tokens')->nullable();
            $table->unsignedInteger('output_tokens')->nullable();
            $table->string('error', 1000)->nullable()->comment('Why Bedrock was not used, when it failed');
            $table->string('data_hash', 64)->comment('OutletContext::hash() the brief was written from');
            $table->foreignId('generated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('generated_at');
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('outlet_briefs');
    }
};
