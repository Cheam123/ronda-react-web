<?php

namespace App\Support;

/**
 * The one rule for a new password, wherever it is set: changing your own,
 * the emailed reset link (web and mobile), and the one made for a new user.
 *
 * Length is what makes a password hard to guess, so there is a floor and no
 * low ceiling; 64 only keeps the field sane and leaves room for a passphrase.
 * Existing passwords keep working until they are next changed.
 */
class PasswordPolicy
{
    public const MIN = 10;
    public const MAX = 64;

    /** Validation rules for the new password field. */
    public static function rules(): array
    {
        return ['required', 'string', 'min:' . self::MIN, 'max:' . self::MAX];
    }

    /** The field's messages, in the words the pages use. */
    public static function messages(string $field): array
    {
        return [
            "$field.required" => 'Enter a new password.',
            "$field.min"      => 'Use at least ' . self::MIN . ' characters.',
            "$field.max"      => 'Use ' . self::MAX . ' characters or fewer.',
        ];
    }
}
