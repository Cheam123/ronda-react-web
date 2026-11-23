<?php

namespace App\Services\Ai;

use Anthropic\Bedrock\MantleClient;
use Anthropic\Client;
use Anthropic\Core\Exceptions\AnthropicException;

/**
 * Claude, through the official Anthropic PHP SDK. Used for the manager daily
 * digest and the rep assistant on the outlet page (visit brief, Ask Ronda,
 * follow-up drafts).
 *
 * By default it calls the Claude API with a key from the Claude Console
 * (ANTHROPIC_API_KEY). With CLAUDE_PROVIDER=bedrock it calls Claude on
 * Amazon Bedrock instead. Settings live in config/ife.php (claude.*).
 * isConfigured() is false when the chosen provider has no credentials;
 * callers then use their template fallback rather than calling out, so the
 * app works without AI.
 */
class ClaudeClient
{
    /** The Claude API model when CLAUDE_MODEL is not set. */
    private const DEFAULT_MODEL = 'claude-opus-5-5';

    /** The Bedrock model when CLAUDE_MODEL is not set. */
    private const DEFAULT_BEDROCK_MODEL = 'anthropic.claude-opus-5';

    /**
     * On the Claude API, a request Claude declines for policy reasons is
     * retried once on the server's default fallback model, so a false
     * positive doesn't leave the rep with nothing. Bedrock has no such
     * option.
     */
    private const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

    public function isConfigured(): bool
    {
        $config = config('ife.claude', []);

        if (!($config['enabled'] ?? false)) {
            return false;
        }

        if ($this->onBedrock()) {
            $bedrock = $config['bedrock'] ?? [];

            return !empty($bedrock['api_key']) || (!empty($bedrock['key']) && !empty($bedrock['secret']));
        }

        return !empty($config['api_key']);
    }

    public function model(): string
    {
        return (string) (config('ife.claude.model') ?: ($this->onBedrock() ? self::DEFAULT_BEDROCK_MODEL : self::DEFAULT_MODEL));
    }

    /**
     * One request, one text answer.
     *
     * @return array{text: string, input_tokens: int, output_tokens: int, cache_read_tokens: int, model: string}
     * @throws \RuntimeException when Claude is not configured, the call fails,
     *                           Claude declines, or no text comes back
     */
    public function complete(string $system, string $prompt, ?string $effort = null): array
    {
        return $this->chat([$system], [['role' => 'user', 'content' => $prompt]], $effort);
    }

    /**
     * A conversation: the system prompt as one or more text blocks, then the
     * turns so far (user first, alternating). With $cache the last system
     * block is a prompt-cache breakpoint, so the next turns of the same chat
     * reuse the outlet's facts instead of paying for them again.
     *
     * @param string[] $system
     * @param array<int, array{role: string, content: string}> $messages
     * @param string|null $effort low | medium | high; null leaves the model's default
     * @return array{text: string, input_tokens: int, output_tokens: int, cache_read_tokens: int, model: string}
     * @throws \RuntimeException as complete()
     */
    public function chat(array $system, array $messages, ?string $effort = null, bool $cache = false): array
    {
        if (!$this->isConfigured()) {
            throw new \RuntimeException('Claude is not configured.');
        }

        $blocks = array_map(fn (string $text) => ['type' => 'text', 'text' => $text], array_values($system));
        if ($cache && $blocks) {
            $blocks[count($blocks) - 1]['cacheControl'] = ['type' => 'ephemeral'];
        }

        $request = [
            'maxTokens'    => (int) config('ife.claude.max_tokens', 16000),
            'messages'     => $messages,
            'model'        => $this->model(),
            'outputConfig' => $effort ? ['effort' => $effort] : null,
            'system'       => $blocks,
        ];

        try {
            $message = $this->onBedrock()
                ? $this->bedrockClient()->messages->create(...$request)
                : (new Client(apiKey: (string) config('ife.claude.api_key')))->beta->messages->create(
                    ...$request,
                    fallbacks: 'default',
                    betas: [self::FALLBACK_BETA],
                );
        } catch (AnthropicException $e) {
            throw new \RuntimeException('Claude call failed: ' . $e->getMessage(), 0, $e);
        }

        if ($message->stopReason === 'refusal') {
            throw new \RuntimeException('Claude declined the request.');
        }

        $text = '';
        foreach ($message->content as $block) {
            if ($block->type === 'text') {
                $text .= $block->text;
            }
        }

        if (trim($text) === '') {
            throw new \RuntimeException('Claude returned no text (stop reason: ' . ($message->stopReason ?? 'unknown') . ').');
        }

        return [
            'text'              => trim($text),
            'input_tokens'      => (int) $message->usage->inputTokens,
            'output_tokens'     => (int) $message->usage->outputTokens,
            'cache_read_tokens' => (int) ($message->usage->cacheReadInputTokens ?? 0),
            // The model that answered: a fallback model when the first one declined.
            'model'             => (string) ($message->model ?: $this->model()),
        ];
    }

    private function onBedrock(): bool
    {
        return config('ife.claude.provider') === 'bedrock';
    }

    private function bedrockClient(): MantleClient
    {
        $config = config('ife.claude.bedrock', []);
        $apiKey = ($config['api_key'] ?? null) ?: null;

        return new MantleClient(
            apiKey             : $apiKey,
            awsAccessKey       : $apiKey ? null : (($config['key'] ?? null) ?: null),
            awsSecretAccessKey : $apiKey ? null : (($config['secret'] ?? null) ?: null),
            awsSessionToken    : $apiKey ? null : (($config['session'] ?? null) ?: null),
            awsRegion          : ($config['region'] ?? null) ?: 'us-east-1',
        );
    }
}
