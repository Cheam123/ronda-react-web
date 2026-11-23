<?php

namespace Tests\Feature;

use App\Models\DocumentUpload;
use App\Models\Leads;
use App\Models\MenuScan;
use App\Models\Product;
use App\Models\Recipe;
use App\Models\RecipeIngredient;
use App\Models\RecommendationFeedback;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** A menu scan from reading to drink ideas, through the real app and web routes. */
class MenuScanTest extends TestCase
{
    use DatabaseTransactions;

    private User $rep;
    private User $otherRep;
    private Leads $lead;

    /** @var array<string, Recipe> */
    private array $drinks = [];

    protected function setUp(): void
    {
        parent::setUp();

        Bus::fake();
        Storage::fake();

        // Only this test's drinks may match, whatever the test database already holds.
        Recipe::query()->update(['is_active' => false]);

        $this->rep      = User::withoutEvents(fn () => User::factory()->create(['type' => User::TYPE_USER, 'status' => 1]));
        $this->otherRep = User::withoutEvents(fn () => User::factory()->create(['type' => User::TYPE_USER, 'status' => 1]));

        $this->lead = Leads::create([
            'name' => 'Kopi Corner Sdn Bhd', 'business_name' => 'Kopi Corner', 'belong_to' => $this->rep->id, 'assign_to' => $this->rep->id,
            'business_category' => 2, 'seats' => 50, 'main_customers' => ['university'],
        ]);

        $product = fn (string $name, float $price) => Product::create([
            'sku' => 'TEST-' . strtoupper(substr(md5($name . uniqid()), 0, 10)), 'name' => $name, 'unit' => 'kg', 'unit_price' => $price,
            'is_halal' => true, 'base_monthly_qty' => 4, 'is_active' => true,
        ]);
        $espresso = $product('Test Espresso', 75);
        $milk     = $product('Test Milk', 8);
        $vanilla  = $product('Test Vanilla Syrup', 30);
        $tea      = $product('Test Green Tea', 40);
        $peach    = $product('Test Peach Syrup', 30);

        $this->drink('Latte', 'coffee', [], [$espresso, $milk]);
        $this->drink('Cappuccino', 'coffee', [], [$espresso, $milk]);
        $this->drink('Iced Vanilla Latte', 'flavoured_coffee', ['Vanilla Latte'], [$espresso, $milk, $vanilla]);
        $this->drink('Iced Peach Green Tea', 'fruit_tea', ['Peach Tea'], [$tea, $peach]);
    }

    private function drink(string $name, string $category, array $aliases, array $products): void
    {
        $recipe = Recipe::create([
            'name' => $name, 'slug' => 'test-' . strtolower(str_replace(' ', '-', $name)) . '-' . uniqid(), 'aliases' => $aliases ?: null, 'category' => $category,
            'serve' => 'either', 'outlet_types' => [2], 'customer_groups' => ['university'], 'price_tier' => 'mid_range', 'is_active' => true,
        ]);

        foreach ($products as $sort => $product) {
            RecipeIngredient::create(['recipe_id' => $recipe->id, 'product_id' => $product->id, 'quantity' => 0.02, 'amount_label' => '20 g', 'sort' => $sort]);
        }

        $this->drinks[$name] = $recipe;
    }

    /** What a phone would send for a two-column menu: names on the left, prices on the right. */
    private function fragments(): string
    {
        $rows  = [['COFFEE', null], ['Latte', '10.00'], ['Cappucino', '10.00'], ['Yuzu Americano', '13.00'], ['Fresh milk, roasted weekly', null]];
        $lines = [];

        foreach ($rows as $index => [$name, $price]) {
            $y       = 100 + $index * 60;
            $lines[] = ['text' => $name, 'page' => 0, 'x' => 40, 'y' => $y, 'width' => 300, 'height' => 32];
            if ($price) {
                $lines[] = ['text' => $price, 'page' => 0, 'x' => 620, 'y' => $y + 3, 'width' => 90, 'height' => 30];
            }
        }

        return json_encode($lines);
    }

    public function test_the_app_sends_a_scan_and_gets_a_draft_to_check(): void
    {
        Sanctum::actingAs($this->rep);

        $scan = $this->post('/api/mobile/leads/menu-scans', [
            'lead_id'   => $this->lead->id,
            'fragments' => $this->fragments(),
            'file'      => [UploadedFile::fake()->image('menu.jpg', 800, 1200)],
        ])->assertOk()->json('data.scan');

        $this->assertSame('draft', $scan['status']);
        $this->assertSame('phone', $scan['source']);
        // The misread "Cappucino" is still the Cappuccino; the heading and the description are left out.
        $this->assertSame(['Latte', 'Cappuccino'], array_column($scan['matched'], 'drink'));
        $this->assertSame(['Yuzu Americano 13.00'], array_column($scan['unrecognised'], 'text'));
        $this->assertEquals(10.0, $scan['median_price']);
        $this->assertSame('mid_range', $scan['price_level']);
        $this->assertSame([], $scan['ideas'], 'ideas wait for the rep to confirm');

        // The photo is kept with the outlet's documents and tied to the scan.
        $photo = DocumentUpload::where('menu_scan_id', $scan['id'])->firstOrFail();
        $this->assertSame($this->lead->id, $photo->lead_id);
        Storage::assertExists("lead/{$this->lead->id}/{$photo->filename}");

        // A draft is not the outlet's menu yet.
        $this->assertNull($this->getJson('/api/mobile/leads/menu?lead_id=' . $this->lead->id)->assertOk()->json('data.menu'));
    }

    public function test_confirming_gives_ideas_that_are_not_on_the_menu(): void
    {
        Sanctum::actingAs($this->rep);

        $scanId = $this->post('/api/mobile/leads/menu-scans', ['lead_id' => $this->lead->id, 'fragments' => $this->fragments()])->json('data.scan.id');
        $menu   = $this->postJson("/api/mobile/leads/menu-scans/{$scanId}/confirm", ['items' => []])->assertOk()->json('data.menu');

        $this->assertSame('confirmed', $menu['status']);
        // The vanilla latte comes first: it is also a kind they lack, and it uses the espresso and milk they have.
        $this->assertSame(['Iced Vanilla Latte', 'Iced Peach Green Tea'], array_column($menu['ideas'], 'name'));

        $peach = $menu['ideas'][1];
        $this->assertContains('Their menu has no fruit tea yet', $peach['reasons']);
        $this->assertContains('For their customers: Students', $peach['reasons']);
        $this->assertSame(['Test Green Tea', 'Test Peach Syrup'], array_column($peach['products'], 'name'));
        $this->assertEquals(4.0, $peach['products'][0]['quantity']);

        // The same menu is what the app reads back, with the reasons a rep can give for declining.
        $again = $this->getJson('/api/mobile/leads/menu?lead_id=' . $this->lead->id)->assertOk()->json('data.menu');
        $this->assertSame($menu['id'], $again['id']);
        $this->assertArrayHasKey('too_expensive', $again['decline_reasons']);
    }

    public function test_the_reps_corrections_change_the_menu_and_the_ideas(): void
    {
        Sanctum::actingAs($this->rep);

        $scan         = $this->post('/api/mobile/leads/menu-scans', ['lead_id' => $this->lead->id, 'fragments' => $this->fragments()])->json('data.scan');
        $cappuccino   = collect($scan['matched'])->firstWhere('drink', 'Cappuccino');
        $unrecognised = $scan['unrecognised'][0];

        // The rep says the Cappuccino isn't there, and that the yuzu row is their vanilla latte.
        $menu = $this->postJson("/api/mobile/leads/menu-scans/{$scan['id']}/confirm", ['items' => [
            ['id' => $cappuccino['id'], 'kept' => false],
            ['id' => $unrecognised['id'], 'recipe_id' => $this->drinks['Iced Vanilla Latte']->id],
        ]])->assertOk()->json('data.menu');

        $this->assertSame(['Latte', 'Iced Vanilla Latte'], array_column(array_filter($menu['matched'], fn ($item) => $item['kept']), 'drink'));
        $this->assertSame([], $menu['unrecognised']);

        $ideas = array_column($menu['ideas'], 'name');
        $this->assertContains('Cappuccino', $ideas, 'what the rep unticked can be an idea again');
        $this->assertNotContains('Iced Vanilla Latte', $ideas);
    }

    public function test_a_declined_drink_stays_off_the_next_scans_ideas_and_the_answer_names_its_scan(): void
    {
        Sanctum::actingAs($this->rep);

        $first = $this->post('/api/mobile/leads/menu-scans', ['lead_id' => $this->lead->id, 'fragments' => $this->fragments()])->json('data.scan.id');
        $this->postJson("/api/mobile/leads/menu-scans/{$first}/confirm", [])->assertOk();

        $peach = $this->drinks['Iced Peach Green Tea'];
        $this->postJson('/api/mobile/leads/recommendations/feedback', [
            'lead_id' => $this->lead->id, 'recipe_id' => $peach->id, 'menu_scan_id' => $first, 'status' => 'declined', 'reason' => 'not_their_customers',
        ])->assertOk();

        $this->assertSame($first, RecommendationFeedback::where('recipe_id', $peach->id)->value('menu_scan_id'));

        $second = $this->post('/api/mobile/leads/menu-scans', ['lead_id' => $this->lead->id, 'fragments' => $this->fragments()])->json('data.scan.id');
        $menu   = $this->postJson("/api/mobile/leads/menu-scans/{$second}/confirm", [])->assertOk()->json('data.menu');

        $this->assertNotContains('Iced Peach Green Tea', array_column($menu['ideas'], 'name'));
        $this->assertSame('declined', $menu['answers']['drink_feedback'][$peach->id]);
        $this->assertSame(2, $menu['scan_count']);
    }

    public function test_a_rep_cannot_scan_or_confirm_for_someone_elses_outlet(): void
    {
        Sanctum::actingAs($this->rep);
        $scanId = $this->post('/api/mobile/leads/menu-scans', ['lead_id' => $this->lead->id, 'fragments' => $this->fragments()])->json('data.scan.id');

        Sanctum::actingAs($this->otherRep);

        $this->post('/api/mobile/leads/menu-scans', ['lead_id' => $this->lead->id, 'fragments' => $this->fragments()]);
        $this->postJson("/api/mobile/leads/menu-scans/{$scanId}/confirm", []);
        $this->assertNull($this->getJson('/api/mobile/leads/menu?lead_id=' . $this->lead->id)->json('data.menu'));

        $this->assertSame(1, MenuScan::where('lead_id', $this->lead->id)->count());
        $this->assertSame('draft', MenuScan::find($scanId)->status);
    }

    public function test_a_scan_with_no_text_is_refused(): void
    {
        Sanctum::actingAs($this->rep);

        $this->post('/api/mobile/leads/menu-scans', ['lead_id' => $this->lead->id, 'fragments' => '[]']);
        $this->post('/api/mobile/leads/menu-scans', ['lead_id' => $this->lead->id, 'fragments' => 'not json']);

        $this->assertSame(0, MenuScan::where('lead_id', $this->lead->id)->count());
    }

    public function test_a_menu_can_be_typed_on_the_web_and_shows_on_the_outlet_page(): void
    {
        $text = "Latte 10\nCappuccino 10\nVanilla Latte 12\nNasi Lemak 9.90";

        $this->actingAs($this->otherRep)->postJson(route('lead.menuScans.store', $this->lead->id), ['text' => $text])->assertNotFound();

        $scan = $this->actingAs($this->rep)->postJson(route('lead.menuScans.store', $this->lead->id), ['text' => $text])->assertOk()->json('data.scan');

        $this->assertSame('typed', $scan['source']);
        $this->assertSame(['Latte', 'Cappuccino', 'Iced Vanilla Latte'], array_column($scan['matched'], 'drink'));
        $this->assertSame(['Nasi Lemak 9.90'], array_column($scan['unrecognised'], 'text'));

        $this->actingAs($this->otherRep)->postJson(route('lead.menuScans.confirm', $scan['id']), [])->assertNotFound();
        $this->actingAs($this->rep)->postJson(route('lead.menuScans.confirm', $scan['id']), [])
            ->assertOk()
            ->assertJsonPath('data.menu.ideas.0.name', 'Iced Peach Green Tea');

        $this->withoutVite()->actingAs($this->rep)->get(route('lead.view', $this->lead->id))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Leads/Show')
                ->where('menu.status', 'confirmed')
                ->where('menu.ideas.0.name', 'Iced Peach Green Tea')
                ->where('drinkIdeas.menu_scan_id', $scan['id'])
                ->where('drinkIdeas.ideas.0.name', 'Iced Peach Green Tea')
                ->where('drinkIdeas.based_on', ['their menu', 'what the owner told you'])
                ->has('menuDrinks'));
    }

    public function test_the_app_gets_the_same_live_ideas_and_only_for_its_own_outlets(): void
    {
        Sanctum::actingAs($this->otherRep);
        $this->getJson('/api/mobile/leads/drink-ideas?lead_id=' . $this->lead->id)->assertJsonPath('status', 'error');

        Sanctum::actingAs($this->rep);
        $this->lead->update(['best_selling_kinds' => ['fruit_tea']]);

        $this->getJson('/api/mobile/leads/drink-ideas?lead_id=' . $this->lead->id)
            ->assertOk()
            ->assertJsonPath('data.ideas.menu_scan_id', null)
            ->assertJsonPath('data.ideas.ideas.0.name', 'Iced Peach Green Tea')
            ->assertJsonPath('data.ideas.based_on', ['what the owner told you'])
            ->assertJsonPath('data.ideas.decline_reasons.too_expensive', 'Too expensive');
    }

    public function test_the_ideas_check_reports_fit_against_simple_picks_and_the_reps_answers(): void
    {
        $this->lead->update(['best_selling_kinds' => ['fruit_tea'], 'improvement_goals' => ['improve_drinks']]);
        RecommendationFeedback::record($this->lead, $this->rep, ['recipe_id' => $this->drinks['Cappuccino']->id, 'status' => 'accepted']);
        RecommendationFeedback::record($this->lead, $this->rep, ['recipe_id' => $this->drinks['Latte']->id, 'status' => 'declined', 'reason' => 'too_expensive']);

        // One idea each, so the top idea can differ from a random pick among three.
        config(['ife.recommendation.menu.idea_limit' => 1]);
        $result = app(\App\Services\Menu\IdeasCheck::class)->run([$this->lead->fresh()]);

        $this->assertSame(1, $result['outlets']);
        $this->assertSame(1, $result['with_ideas']);
        // Peach tea is the one fruit tea, so it leads; the others meet no need.
        $this->assertSame('Iced Peach Green Tea', $result['top_drinks'][0]['name']);
        $this->assertGreaterThan($result['needs']['random'], $result['needs']['engine']);
        $this->assertSame(1.0, $result['needs']['changed'], 'without the needs the top ideas differ');
        $this->assertSame(['pitched' => 0, 'accepted' => 1, 'declined' => 1, 'acceptance' => 0.5, 'reasons' => ['Too expensive' => 1]], $result['answers']);
    }

    /** Textract switched on, with a stand-in that reads "Latte 10.00" from each photo, or fails. */
    private function fakeTextract(int $monthlyPhotos = 10, bool $fails = false): void
    {
        config([
            'ife.recommendation.menu.reader'                  => 'textract',
            'ife.recommendation.menu.textract.key'            => 'test-key',
            'ife.recommendation.menu.textract.secret'         => 'test-secret',
            'ife.recommendation.menu.textract.monthly_photos' => $monthlyPhotos,
        ]);
        $this->app->bind(\App\Services\Menu\PhotoReader::class, fn () => new class($fails) implements \App\Services\Menu\PhotoReader {
            public function __construct(private bool $fails)
            {
            }

            public function read(array $paths): array
            {
                if ($this->fails) {
                    throw new \RuntimeException('Textract is down');
                }

                return array_map(fn ($path, $page) => ['text' => 'Latte 10.00', 'page' => $page, 'x' => 10, 'y' => 10, 'width' => 200, 'height' => 30, 'group' => 'LAYOUT_TEXT'], $paths, array_keys($paths));
            }
        });
    }

    public function test_with_textract_on_the_server_reads_the_phones_photos_instead_of_the_phone(): void
    {
        $this->fakeTextract(monthlyPhotos: 3);
        Sanctum::actingAs($this->rep);
        // What the phone read itself: Cappuccino. Textract reads Latte, and its reading wins.
        $phone = json_encode([['text' => 'Cappuccino 11.00', 'page' => 0]]);

        $scan = $this->post('/api/mobile/leads/menu-scans', [
            'lead_id'   => $this->lead->id,
            'fragments' => $phone,
            'file'      => [UploadedFile::fake()->image('menu.jpg', 800, 1200), UploadedFile::fake()->image('menu2.jpg', 800, 1200)],
        ])->assertOk()->json('data.scan');

        $this->assertSame('textract', $scan['source']);
        $this->assertSame(['Latte'], array_unique(array_column($scan['matched'], 'drink')));
        $this->assertSame(['Latte 10.00', 'Latte 10.00'], $scan['lines'], 'a draft lists every line read');

        // Over this month's limit (2 read, 2 more, limit 3): the phone's own reading is used.
        $scan = $this->post('/api/mobile/leads/menu-scans', [
            'lead_id' => $this->lead->id, 'fragments' => $phone,
            'file'    => [UploadedFile::fake()->image('menu3.jpg'), UploadedFile::fake()->image('menu4.jpg')],
        ])->assertOk()->json('data.scan');
        $this->assertSame('phone', $scan['source']);
        $this->assertSame(['Cappuccino'], array_column($scan['matched'], 'drink'));

        // With no reading from the phone either, the rep is told why.
        $this->post('/api/mobile/leads/menu-scans', [
            'lead_id' => $this->lead->id,
            'file'    => [UploadedFile::fake()->image('menu5.jpg'), UploadedFile::fake()->image('menu6.jpg')],
        ])->assertJsonPath('status', 'error')
            ->assertJsonPath('message', "This month's limit for reading menu photos is reached. Try again, or type the menu in on the web.");

        // Without Textract, photos with no text are refused as before.
        config(['ife.recommendation.menu.reader' => 'phone']);
        $this->post('/api/mobile/leads/menu-scans', ['lead_id' => $this->lead->id, 'file' => [UploadedFile::fake()->image('menu7.jpg')]])
            ->assertJsonPath('status', 'error');
    }

    public function test_when_textract_fails_the_phones_own_reading_is_used(): void
    {
        $this->fakeTextract(fails: true);
        Sanctum::actingAs($this->rep);

        $scan = $this->post('/api/mobile/leads/menu-scans', [
            'lead_id'   => $this->lead->id,
            'fragments' => json_encode([['text' => 'Cappuccino 11.00', 'page' => 0]]),
            'file'      => [UploadedFile::fake()->image('menu.jpg')],
        ])->assertOk()->json('data.scan');

        $this->assertSame('phone', $scan['source']);
        $this->assertSame(['Cappuccino'], array_column($scan['matched'], 'drink'));
    }

    public function test_the_phone_is_told_whether_to_send_photos_as_they_are(): void
    {
        Sanctum::actingAs($this->rep);
        $menu = fn () => $this->getJson('/api/mobile/leads/menu?lead_id=' . $this->lead->id)->assertOk();

        $menu()->assertJsonPath('data.reads_photos', false);

        $this->fakeTextract();
        $menu()->assertJsonPath('data.reads_photos', true);

        // reader=phone uses the phone's reading even with Textract on (the fallback after a failure).
        $scan = $this->post('/api/mobile/leads/menu-scans', [
            'lead_id'   => $this->lead->id,
            'reader'    => 'phone',
            'fragments' => json_encode([['text' => 'Cappuccino 11.00', 'page' => 0]]),
            'file'      => [UploadedFile::fake()->image('menu.jpg')],
        ])->assertOk()->json('data.scan');
        $this->assertSame('phone', $scan['source']);
        $this->assertSame(['Cappuccino'], array_column($scan['matched'], 'drink'));
    }

    public function test_menu_photos_uploaded_on_the_outlet_page_are_read_by_textract(): void
    {
        $upload = fn (array $files) => $this->actingAs($this->rep)->post(
            route('lead.menuScans.store', $this->lead->id),
            ['file' => $files],
            ['Accept' => 'application/json']
        );

        // Not set up: the page has no photo button, and the endpoint refuses photos.
        $this->withoutVite()->actingAs($this->rep)->get(route('lead.view', $this->lead->id))
            ->assertInertia(fn ($page) => $page->where('menuPhotos', false));
        $upload([UploadedFile::fake()->image('menu.jpg')])->assertStatus(422);

        $this->fakeTextract();
        $this->withoutVite()->actingAs($this->rep)->get(route('lead.view', $this->lead->id))
            ->assertInertia(fn ($page) => $page->where('menuPhotos', true));

        // Textract reads JPEG and PNG only.
        $upload([UploadedFile::fake()->create('menu.pdf', 100, 'application/pdf')])->assertStatus(422)->assertJsonValidationErrors('file.0');

        $scan = $upload([UploadedFile::fake()->image('menu.jpg', 800, 1200)])->assertOk()->json('data.scan');
        $this->assertSame('textract', $scan['source']);
        $this->assertSame('draft', $scan['status']);
        $this->assertSame(['Latte'], array_column($scan['matched'], 'drink'));
        $this->assertSame(['Latte 10.00'], $scan['lines']);
        $this->assertCount(1, $scan['photos'], 'the photo is kept with the outlet\'s documents');
        $this->assertSame(1, DocumentUpload::where('lead_id', $this->lead->id)->whereNotNull('menu_scan_id')->count());

        // Once confirmed it is the outlet's menu, and the lines are no longer sent.
        $menu = $this->actingAs($this->rep)->postJson(route('lead.menuScans.confirm', $scan['id']), ['items' => []])->assertOk()->json('data.menu');
        $this->assertSame('textract', $menu['source']);
        $this->assertSame([], $menu['lines']);

        // A failure is explained.
        $this->fakeTextract(fails: true);
        $upload([UploadedFile::fake()->image('menu2.jpg')])->assertStatus(422)
            ->assertJsonPath('message', 'The photos could not be read just now. Try again, or type the menu in.');
    }

    public function test_the_menu_check_scores_readings_against_their_answer_lists(): void
    {
        $dir = sys_get_temp_dir() . '/ronda-menu-check-' . uniqid();
        mkdir($dir);
        // A two-column phone copy: the misread "Cappucino" still counts; the description is left out.
        file_put_contents("{$dir}/corner.txt", "Photo 1 (x,y,width,height | text)\n40,100,300,32 | Latte\n620,103,90,30 | 1O.00\n40,160,300,32 | Cappucino\n620,163,90,30 | 11.00\n40,220,300,32 | espresso, milk, vanilla");
        file_put_contents("{$dir}/corner.answer.txt", "Latte\nCappuccino\nVanilla Latte\nYuzu Soda\n");
        file_put_contents("{$dir}/lonely.txt", 'Latte 10');

        $this->artisan('menu:check', ['folder' => $dir])
            ->expectsOutputToContain('Skipped lonely.txt')
            ->expectsOutputToContain('Right:  Latte, Cappuccino')
            ->expectsOutputToContain('Missed: Iced Vanilla Latte')
            ->expectsOutputToContain('Not one of the drinks, so left out of the answers: Yuzu Soda')
            ->assertSuccessful();

        $fragments = \App\Services\Menu\MenuCheck::fragmentsFromCopy("Photo 2 (x,y,width,height | text)\n1,2,30,40 | Teh O\nTyped line");
        $this->assertSame([
            ['text' => 'Teh O', 'page' => 1, 'x' => 1, 'y' => 2, 'width' => 30, 'height' => 40],
            ['text' => 'Typed line', 'page' => 1],
        ], $fragments);

        array_map('unlink', glob("{$dir}/*"));
        rmdir($dir);
    }

    public function test_an_admin_can_run_the_ideas_check_from_the_drinks_page(): void
    {
        config(['ife.recommendation.menu.check_path' => sys_get_temp_dir() . '/ronda-ideas-check-' . uniqid() . '.json']);
        $admin = User::withoutEvents(fn () => User::factory()->create(['type' => User::TYPE_ADMIN, 'status' => 1]));

        $this->withoutVite()->actingAs($admin)->get(route('recipe.index'))->assertInertia(fn ($page) => $page->where('ideasCheck', null));

        $this->actingAs($admin)->post(route('recipe.ideasCheck'))->assertRedirect();

        $this->withoutVite()->actingAs($admin)->get(route('recipe.index'))
            ->assertInertia(fn ($page) => $page->has('ideasCheck.checked_at')->has('ideasCheck.needs.engine'));

        @unlink(config('ife.recommendation.menu.check_path'));
    }

    public function test_the_outlet_page_gives_ideas_before_any_menu_and_the_needs_change_them(): void
    {
        $ideas = fn () => $this->withoutVite()->actingAs($this->rep)->get(route('lead.view', $this->lead->id))
            ->assertOk()
            ->viewData('page')['props']['drinkIdeas'];

        // A cafe for students, nothing else known: every drink fits as well, so they go by name.
        $before = $ideas();
        $this->assertNull($before['menu_scan_id']);
        $this->assertSame(['what the owner told you'], $before['based_on']);
        $this->assertSame(['Cappuccino', 'Iced Peach Green Tea', 'Iced Vanilla Latte'], array_column($before['ideas'], 'name'));

        // The owner says fruit tea sells best and wants to raise spend; the typical drink is RM 9.
        $this->lead->update(['best_selling_kinds' => ['fruit_tea'], 'improvement_goals' => ['average_spend'], 'typical_drink_price' => 9]);

        $after = $ideas()['ideas'][0];
        $this->assertSame('Iced Peach Green Tea', $after['name']);
        $this->assertSame('Like their best sellers: fruit tea', $after['reasons'][0]);
        // Best seller 1, spend 0.5 (same mid-range level as RM 9).
        $this->assertSame(0.75, $after['parts']['needs']);
        $this->assertSame(1.0, $after['parts']['price']);
    }

    public function test_an_admin_sees_what_menus_hold_and_can_add_an_unrecognised_line_as_another_name(): void
    {
        $admin = User::withoutEvents(fn () => User::factory()->create(['type' => User::TYPE_ADMIN, 'status' => 1]));
        $text  = "Latte 10\nDirty Vanilla RM 13\nNasi Lemak 9.90";

        $scan = $this->actingAs($this->rep)->postJson(route('lead.menuScans.store', $this->lead->id), ['text' => $text])->json('data.scan');
        $this->actingAs($this->rep)->postJson(route('lead.menuScans.confirm', $scan['id']), [])->assertOk();

        $latte   = $this->drinks['Latte'];
        $vanilla = $this->drinks['Iced Vanilla Latte'];

        $this->withoutVite()->actingAs($admin)->get(route('recipe.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Recipes/Index')
                ->where('stats.menus', fn ($menus) => $menus >= 1)
                ->where('recipes', fn ($recipes) => collect($recipes)->firstWhere('id', $latte->id)['on_menus'] === 1)
                ->where('unrecognised', fn ($rows) => collect($rows)->pluck('text')->contains('Dirty Vanilla')));

        // A rep can't change the drinks list.
        $this->actingAs($this->rep)->post(route('recipe.alias', $vanilla->id), ['alias' => 'Dirty Vanilla']);
        $this->assertNotContains('Dirty Vanilla', $vanilla->fresh()->names());

        $this->actingAs($admin)->post(route('recipe.alias', $vanilla->id), ['alias' => 'Dirty Vanilla'])->assertRedirect();
        $this->actingAs($admin)->post(route('recipe.alias', $vanilla->id), ['alias' => 'dirty vanilla'])->assertRedirect();
        $this->assertSame(['Iced Vanilla Latte', 'Vanilla Latte', 'Dirty Vanilla'], $vanilla->fresh()->names(), 'added once, whatever the case');

        // The next scan of the same menu recognises it.
        $next = $this->actingAs($this->rep)->postJson(route('lead.menuScans.store', $this->lead->id), ['text' => $text])->json('data.scan');
        $this->assertSame(['Latte', 'Iced Vanilla Latte'], array_column($next['matched'], 'drink'));
    }
}
