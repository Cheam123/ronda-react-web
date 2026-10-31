import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import TextInput from './TextInput';

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
    invalid?: boolean;
}

/**
 * A password box with a Show button beside it, so a password typed on a phone
 * can be checked before it is sent. Inside a Field it is described by the
 * Field's hint or error, like TextInput.
 */
const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
    { invalid, ...props },
    ref,
) {
    const [shown, setShown] = useState(false);

    return (
        <div className="rd-secret">
            <TextInput ref={ref} large type={shown ? 'text' : 'password'} invalid={invalid} {...props} />
            <button
                type="button"
                className="rd-btn rd-btn--lg"
                aria-pressed={shown}
                aria-label={shown ? 'Hide the password' : 'Show the password'}
                onClick={() => setShown((visible) => !visible)}
            >
                <i className={`mdi ${shown ? 'mdi-eye-off-outline' : 'mdi-eye-outline'}`} aria-hidden="true" />
                {shown ? 'Hide' : 'Show'}
            </button>
        </div>
    );
});

export default PasswordInput;
