/**
 * Malaysian phone numbers. Ronda stores them as digits with the country code
 * ("60123456789"); older rows may hold the local form ("0123456789") or
 * something foreign. People read them in the local form with the usual
 * spacing: 012-345 6789, 011-2345 6789, 03-1234 5678, 082-123 456.
 */

/** The local form's digits ("0123456789"), or null when it is not a Malaysian number. */
function nationalDigits(value: string | null | undefined): string | null {
    const digits = (value ?? '').replace(/\D/g, '');

    if (digits.startsWith('60') && digits.length >= 10) {
        return `0${digits.slice(2)}`;
    }
    if (digits.startsWith('0') && digits.length >= 9) {
        return digits;
    }
    // A mobile saved without its leading 0 or country code ("123456789").
    if (digits.startsWith('1') && (digits.length === 9 || digits.length === 10)) {
        return `0${digits}`;
    }

    return null;
}

/** "0123456789" -> "012-345 6789"; digits it cannot place are returned as they came. */
function spaced(national: string): string {
    const group = (prefix: string, rest: string) => {
        if (rest.length === 8) {
            return `${prefix}-${rest.slice(0, 4)} ${rest.slice(4)}`;
        }
        if (rest.length === 7) {
            return `${prefix}-${rest.slice(0, 3)} ${rest.slice(3)}`;
        }
        if (rest.length === 6) {
            return `${prefix}-${rest.slice(0, 3)} ${rest.slice(3)}`;
        }
        return `${prefix}-${rest}`;
    };

    if (national.startsWith('01')) {
        return group(national.slice(0, 3), national.slice(3)); // mobiles: 01X
    }
    if (national.startsWith('08')) {
        return group(national.slice(0, 3), national.slice(3)); // Sabah and Sarawak: 08X
    }

    return group(national.slice(0, 2), national.slice(2)); // other landlines: 0X
}

/** A number as people read it ("012-345 6789"). Anything not Malaysian is shown as stored. */
export function formatPhone(value: string | null | undefined): string {
    const national = nationalDigits(value);

    return national ? spaced(national) : (value ?? '').trim();
}

/** A tel: link for the number, or null when there is nothing to dial. */
export function phoneHref(value: string | null | undefined): string | null {
    const national = nationalDigits(value);
    if (national) {
        return `tel:+60${national.slice(1)}`;
    }
    const digits = (value ?? '').replace(/[^\d+]/g, '');

    return digits ? `tel:${digits}` : null;
}

/**
 * What the +60 phone input shows: the local form without its leading 0
 * ("12-345 6789").
 */
export function phoneInputText(value: string | null | undefined): string {
    const national = nationalDigits(value);

    return national ? spaced(national).slice(1) : (value ?? '');
}

/**
 * What the +60 phone input stores for whatever was typed: "60" and the
 * digits, dropping a leading 0 or a repeated country code ("012 345 6789",
 * "+60123456789" and "123456789" all give "60123456789").
 */
export function phoneFromInput(text: string): string {
    let digits = text.replace(/\D/g, '');
    if (digits.startsWith('60')) {
        digits = digits.slice(2);
    }
    digits = digits.replace(/^0+/, '');

    return digits ? `60${digits}` : '';
}
