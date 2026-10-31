<?php

use App\Http\Controllers\FCMController;
use App\Http\Controllers\FirebaseController;
use Illuminate\Support\Facades\Route;


Route::group(['middleware' => ['api'], 'prefix' => 'mobile'], function () {

    Route::get('/version', 'MobileApp\HomeController@getLifeVersion')->name('mobile.version');

    Route::get('/download-link', 'MobileApp\HomeController@getAppDownloadLink')->name('mobile.downloadLink');

    Route::post('/login', 'Auth\LoginController@mobileLogin')->name('login');
    Route::post('/logout', 'Auth\LoginController@mobileLogout')->name('logout');

    /* Forgot password — same broker, token table and email as the web.
       Public on purpose: nobody asking for a reset can present a token. */
    Route::post('/password/forgot', 'Auth\ForgotPasswordController@mobileSendResetLink')->name('password.forgot');
    Route::post('/password/reset', 'Auth\ResetPasswordController@mobileReset')->name('password.reset');

    // Error Logging
    Route::post('/error/log', 'MobileApp\ErrorController@store')->name('error.log');

    Route::middleware('auth:sanctum')->group(function () {
    //Home
      Route::get('/home', 'MobileApp\HomeController@index')->name('home');

    // Account
      Route::post('/account/delete', 'MobileApp\AccountController@requestDeletion')->name('account.delete');

    // Leads
      Route::get('/leads', 'MobileApp\LeadController@index')->name('leads');
      Route::get('/leads/get', 'MobileApp\LeadController@getLeadByID')->name('leads.getByID');
      Route::get('/leads/media', 'MobileApp\LeadController@getLeadMedia')->name('leads.media');
      Route::get('/leads/tasks', 'MobileApp\LeadController@getLeadTasks')->name('leads.tasks');
      Route::get('/leads/filterOptions', 'MobileApp\LeadController@getFilterOptions')->name('leads.filter.options');

      Route::post('/leads/create', 'MobileApp\LeadController@addLead')->name('leads.create');
      Route::post('/leads/edit', 'MobileApp\LeadController@editLead')->name('leads.edit');

    // Outlet screen: visit history, order history, recommendations
      Route::get('/leads/visits', 'MobileApp\LeadController@getLeadVisits')->name('leads.visits');
      Route::get('/leads/orders', 'MobileApp\LeadController@getLeadOrders')->name('leads.orders');
      Route::post('/leads/orders/create', 'MobileApp\LeadController@addLeadOrder')->name('leads.orders.create');
      Route::get('/leads/recommendations', 'MobileApp\LeadController@getLeadRecommendations')->name('leads.recommendations');

    // Ronda assistant on the outlet screen (Claude on Bedrock), as on the web.
      Route::get('/leads/{id}/assistant/brief', 'MobileApp\OutletAssistantController@showBrief')->name('leads.assistant.showBrief');
      Route::middleware('throttle:assistant')->group(function () {
        Route::post('/leads/{id}/assistant/brief', 'MobileApp\OutletAssistantController@brief')->name('leads.assistant.brief');
        Route::post('/leads/{id}/assistant/chat', 'MobileApp\OutletAssistantController@chat')->name('leads.assistant.chat');
        Route::post('/leads/{id}/assistant/follow-up', 'MobileApp\OutletAssistantController@followUp')->name('leads.assistant.followUp');
        Route::post('/leads/{id}/assistant/pitches', 'MobileApp\OutletAssistantController@pitches')->name('leads.assistant.pitches');
      });

    // Product catalogue (read-only)
      Route::get('/products', 'MobileApp\ProductController@index')->name('products');

    // Tasks
      Route::get('/tasks', 'MobileApp\TaskController@index')->name('tasks');
      Route::post('/tasks/create', 'MobileApp\TaskController@addTask')->name('tasks.create');
      Route::post('/tasks/edit', 'MobileApp\TaskController@updateTask')->name('tasks.edit');
      Route::get('/tasks/get', 'MobileApp\TaskController@getTaskByID')->name('tasks.getByID');
      Route::get('/tasks/media', 'MobileApp\TaskController@getTaskMedia')->name('tasks.media');
      Route::get('/tasks/filterOptions', 'MobileApp\TaskController@getFilterOptions')->name('tasks.filter.options');
      Route::get('/tasks/chatHistory', 'MobileApp\TaskController@getChatHistory')->name('tasks.chatHistory');
      Route::post('/tasks/storeChat', 'MobileApp\TaskController@storeChat')->name('tasks.storeChat');
      Route::post('/tasks/editChat', 'MobileApp\TaskController@editChat')->name('tasks.editChat');
      Route::post('/tasks/deleteChat', 'MobileApp\TaskController@deleteChat')->name('tasks.deleteChat');
      Route::post('/tasks/markChatAsRead', 'MobileApp\TaskController@markChatAsRead')->name('tasks.markChatAsRead');

      Route::post('/tasks/markAsInProgress', 'MobileApp\TaskController@marked_as_inprogress')->name('tasks.markAsInProgress');
      Route::post('/tasks/markAsOnHold', 'MobileApp\TaskController@marked_as_onhold')->name('tasks.markAsOnHold');
      Route::post('/tasks/markAsDone', 'MobileApp\TaskController@marked_as_done')->name('tasks.markAsDone');
      Route::post('/tasks/markAsFallback', 'MobileApp\TaskController@marked_as_fallback')->name('tasks.markAsFallback');
      Route::post('/tasks/markAsVerified', 'MobileApp\TaskController@marked_as_verified')->name('tasks.markAsVerified');
      Route::post('/tasks/markAsKIV', 'MobileApp\TaskController@marked_as_kiv')->name('tasks.markAsKIV');
      Route::post('/tasks/markAsRejected', 'MobileApp\TaskController@marked_as_rejected')->name('tasks.markAsRejected');
      Route::post('/tasks/markAsCompleted', 'MobileApp\TaskController@marked_as_completed')->name('tasks.markAsCompleted');

    // Notifications
     Route::get('/notifications', 'NotificationController@sendPushNotification')->name('notifications.send');

     // IFE
     Route::get('/ife/list', 'MobileApp\IFEController@getIFEList')->name('ife.list');
     Route::get('/ife/fields', 'MobileApp\IFEController@getIFEFields')->name('ife.fields');
     Route::get('/ife/get', 'MobileApp\IFEController@getIFEReport')->name('ife.get');
     Route::get('/ife/recent', 'MobileApp\IFEController@getRecentReports')->name('ife.recent');

     // Focus alerts: every push, saved (see AlertInbox)
     Route::get('/alerts', 'MobileApp\AlertController@index')->name('alerts');
     Route::post('/alerts/read', 'MobileApp\AlertController@markRead')->name('alerts.read');

     // Me: this month, and the orders I recorded
     Route::get('/me/stats', 'MobileApp\MeController@stats')->name('me.stats');
     Route::get('/orders', 'MobileApp\MeController@orders')->name('orders.mine');

     // Team (Managers and Admins)
     Route::get('/team', 'MobileApp\TeamController@index')->name('team');
     Route::get('/team/person', 'MobileApp\TeamController@person')->name('team.person');
     Route::post('/ife/create', 'MobileApp\IFEController@addIFEAdhocReport')->name('ife.create');
     Route::post('/ife/update', 'MobileApp\IFEController@updateIFEReport')->name('ife.update');
     Route::post('/ife/delete', 'MobileApp\IFEController@deleteIFEReport')->name('ife.delete');

      // FCM Token Management
      Route::post('updateFCMToken', [FCMController::class, 'updateDeviceToken']);
      Route::post('sendNotification', [FCMController::class, 'sendFcmNotification']);

    /* Forms — the mobile app covers three areas only: Start, My Records and
       My Tasks. Building/administering forms is web-only.
       Static segments are declared before /forms/{id} so the wildcard does
       not capture "records" / "tasks" / "entries". */

    // Start
    Route::get('/forms', 'MobileApp\FormsController@getAllForms')->name('forms.index');

    // My Records
    Route::get('/forms/records', 'MobileApp\FormsController@getRecords')->name('forms.records.index');
    Route::get('/forms/records/{id}', 'MobileApp\FormsController@getRecord')->name('forms.records.show');
    Route::post('/forms/records/{id}/close', 'MobileApp\FormsController@closeRecord')->name('forms.records.close');

    // Entries of a record (also the detail a task links to)
    Route::get('/forms/entries/{id}', 'MobileApp\FormsController@getEntry')->name('forms.entries.show');
    Route::put('/forms/entries/{id}', 'MobileApp\FormsController@updateEntry')->name('forms.entries.update');
    Route::patch('/forms/entries/{id}/cancel', 'MobileApp\FormsController@cancelEntry')->name('forms.entries.cancel');
    Route::post('/forms/entries/{id}/clone', 'MobileApp\FormsController@cloneEntry')->name('forms.entries.clone');

    // My Tasks

    Route::get('/forms/tasks', 'MobileApp\FormsController@getTasks')->name('forms.tasks.index');
    Route::post('/forms/tasks/{id}/approve', 'MobileApp\FormsController@approveSubmission')->name('forms.tasks.approve');
    Route::post('/forms/tasks/{id}/reject', 'MobileApp\FormsController@rejectSubmission')->name('forms.tasks.reject');
    Route::post('/forms/tasks/{id}/fill', 'MobileApp\FormsController@completeFillStage')->name('forms.tasks.fill');

    // Start (form definition + submit) — wildcards last.
    // /forms/{id}/parents is declared before /forms/{id} for the same reason
    // the static segments above are: read top to bottom, the specific first.
    Route::get('/forms/{id}/parents', 'MobileApp\FormsController@getParentOptions')->name('forms.parents');
    Route::get('/forms/{id}', 'MobileApp\FormsController@getForm')->name('forms.show');
    Route::post('/forms/{id}/submit', 'MobileApp\FormsController@submitForm')->name('forms.submit');

  });
  });
