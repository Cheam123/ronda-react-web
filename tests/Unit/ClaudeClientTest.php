<?php

namespace Tests\Unit;

use App\Services\Ai\ClaudeClient;
use Tests\TestCase;

/**
 * Which way Claude is called: the Claude API with a Claude Console key by
 * default, or Amazon Bedrock when asked for, and nothing at all without a key.
 */
class ClaudeClientTest extends TestCase
{
    private function settings(array $claude): void
    {
        config(['ife.claude' => array_replace([
            'enabled'    => true,
            'provider'   => 'anthropic',
            'api_key'    => null,
            'model'      => null,
            'max_tokens' => 16000,
            'bedrock'    => ['region' => 'us-east-1', 'api_key' => null, 'key' => null, 'secret' => null, 'session' => null],
        ], $claude)]);
    }

    public function test_the_claude_api_needs_a_console_key()
    {
        $this->settings([]);
        $this->assertFalse((new ClaudeClient())->isConfigured());

        $this->settings(['api_key' => 'test-key']);
        $this->assertTrue((new ClaudeClient())->isConfigured());
        $this->assertSame('claude-opus-5-5', (new ClaudeClient())->model());

        // Switched off, a key changes nothing.
        $this->settings(['api_key' => 'test-key', 'enabled' => false]);
        $this->assertFalse((new ClaudeClient())->isConfigured());
    }

    public function test_bedrock_uses_its_own_credentials_and_model()
    {
        // A Claude Console key is not a Bedrock credential.
        $this->settings(['provider' => 'bedrock', 'api_key' => 'test-key']);
        $this->assertFalse((new ClaudeClient())->isConfigured());

        $this->settings(['provider' => 'bedrock', 'bedrock' => ['region' => 'us-east-1', 'api_key' => null, 'key' => 'id', 'secret' => 'secret', 'session' => null]]);
        $this->assertTrue((new ClaudeClient())->isConfigured());
        $this->assertSame('anthropic.claude-opus-5', (new ClaudeClient())->model());
    }

    public function test_the_model_can_be_chosen()
    {
        $this->settings(['api_key' => 'test-key', 'model' => 'claude-sonnet-5-5']);

        $this->assertSame('claude-sonnet-5-5', (new ClaudeClient())->model());
    }

    public function test_without_a_key_nothing_is_sent()
    {
        $this->settings([]);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Claude is not configured.');
        (new ClaudeClient())->complete('System', 'Hello');
    }
}
