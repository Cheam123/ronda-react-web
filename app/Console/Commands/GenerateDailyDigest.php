<?php

namespace App\Console\Commands;

use App\Services\DailyDigestService;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

class GenerateDailyDigest extends Command
{
    protected $signature = 'digest:daily {--date= : Write the digest as of this date (Y-m-d) instead of today}';

    protected $description = 'Write the manager daily digest (Claude, or the template without it)';

    public function handle(DailyDigestService $digests): int
    {
        $now = $this->option('date') ? Carbon::parse($this->option('date'))->setTimeFrom(Carbon::now()) : Carbon::now();

        $digest = $digests->generate($now);

        $this->info('Digest for ' . $digest->digest_date->toDateString() . ' written by ' . $digest->source
            . ($digest->error ? ' (Claude error: ' . $digest->error . ')' : '') . '.');
        $this->line($digest->content);

        return self::SUCCESS;
    }
}
