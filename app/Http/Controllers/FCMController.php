<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;

class FCMController extends Controller
{
    public function updateDeviceToken(Request $request)
    {
        $userId = $request->user()->id;

        $request->validate([
            'fcm_token' => 'required|string',
        ]);

        $user = User::find($userId);

        if (!$user) {
            return response()->json(['error' => 'User not found'], 404);
        }

        $user->fcm_token = $request->fcm_token;
        $user->save();

        return response()->json(['message' => 'Device token updated successfully']);
    }

}
