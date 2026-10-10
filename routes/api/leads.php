<?php

use Illuminate\Support\Facades\Route;


Route::group(['middleware' => ['auth']], function () {

    Route::get('/','API\V1\LeadController@index')->name('lead.index');
    
    Route::get('/view/{id}', 'API\V1\LeadController@view')->name('lead.view');
    
    Route::get('/edit/{id}', 'API\V1\LeadController@edit')->name('lead.edit');
    Route::post('/update', 'API\V1\LeadController@update')->name('lead.update');
    
    Route::get('/create', 'API\V1\LeadController@create')->name('lead.create');
    Route::post('/store', 'API\V1\LeadController@store')->name('lead.store');

    Route::post('/delete', 'API\V1\LeadController@delete')->name('lead.delete');
    Route::post('/delete-many', 'API\V1\LeadController@deleteMany')->name('lead.delete.many');

    # Orders placed by the outlet
    Route::get('/{id}/orders/create', 'API\V1\OrderController@create')->name('lead.orders.create');
    Route::post('/{id}/orders', 'API\V1\OrderController@store')->name('lead.orders.store');
    Route::post('/orders/{order}/cancel', 'API\V1\OrderController@cancel')->name('lead.orders.cancel');

    # Ronda assistant on the outlet page (Claude on Bedrock)
    Route::middleware('throttle:assistant')->group(function () {
        Route::post('/{id}/assistant/brief', 'API\V1\OutletAssistantController@brief')->name('lead.assistant.brief');
        Route::post('/{id}/assistant/chat', 'API\V1\OutletAssistantController@chat')->name('lead.assistant.chat');
        Route::post('/{id}/assistant/follow-up', 'API\V1\OutletAssistantController@followUp')->name('lead.assistant.followUp');
        Route::post('/{id}/assistant/pitches', 'API\V1\OutletAssistantController@pitches')->name('lead.assistant.pitches');
    });

    Route::post('/files/store', 'API\V1\LeadController@fileStore')->name('lead.file.store');
    Route::get('/files/download', 'API\V1\LeadController@download')->name('lead.file.download');
    Route::get('/files/remove', 'API\V1\LeadController@deleteDocument')->name('lead.file.delete');
});
