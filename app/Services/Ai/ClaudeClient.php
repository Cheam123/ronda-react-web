<?php

namespace App\Services\Ai;

use Anthropic\Bedrock\MantleClient;
use Anthropic\Core\Exceptions\AnthropicException;

/**
 * Claude on Amazon Bedrock, through the official Anthropic PHP SDK's Bedrock
 * (Mantle) client. Used for the manager daily digest, the "Why these?"
 * explanation on product recommendations, and the rep assistant on the
 * outlet page (visit brief, Ask Ronda, follow-up drafts, pitch tips).
 *
 * Settings live in config/ife.php (bedrock.*). isConfigured() is false when
 * no Bedrock credentials are set; callers then use their template fallback
 * rather than calling out, so the app works without AWS.
 */
class ClaudeClient
{
    public function isConfigured(): bool
    {
        $config = config('ife.bedrock', []);

        if (!($config['enabled'] ?? false)) {
            return false;
        }

        return !empty($config['api_key']) || (!empty($config['key']) && !empty($config['secret']));
    }

    public function model(): string
    {
        return (string) config('ife.bedrock.model', 'anthropic.claude-opus-5');
    }

    /**
     * One request, one text answer.
     *
     * @return array{text: string, input_tokens: int, output_tokens: int, cache_read_tokens: int, model: string}
     * @throws \RuntimeException when Bedrock is not configured, the call fails,
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
            throw new \RuntimeException('Bedrock is not configured.');
        }

        $config = config('ife.bedrock');
        $apiKey = $config['api_key'] ?: null;

        $blocks = array_map(fn (string $text) => ['type' => 'text', 'text' => $text], array_values($system));
        if ($cache && $blocks) {
            $blocks[count($blocks) - 1]['cacheControl'] = ['type' => 'ephemeral'];
        }

        try {
            $client = new MantleClient(
                apiKey             : $apiKey,
                awsAccessKey       : $apiKey ? null : ($config['key'] ?: null),
                awsSecretAccessKey : $apiKey ? null : ($config['secret'] ?: null),
                awsSessionToken    : $apiKey ? null : ($config['session'] ?: null),
                awsRegion          : $config['region'] ?: 'us-east-1',
            );

            $message = $client->messages->create(
                maxTokens    : (int) ($config['max_tokens'] ?? 16000),
                messages     : $messages,
                model        : $this->model(),
                outputConfig : $effort ? ['effort' => $effort] : null,
                system       : $blocks,
            );
        } catch (AnthropicException $e) {
            throw new \RuntimeException('Bedrock call failed: ' . $e->getMessage(), 0, $e);
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
            'model'             => $this->model(),
        ];
    }
}
