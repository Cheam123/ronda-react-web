/** A user as App\Http\Resources\Users\UserResource sends it. */
export interface User {
    id: number;
    name: string;
    username: string | null;
    email: string;
    mobile: string;
    telegram_chat_id: string | null;
    gender: 'M' | 'F' | null;
    gender_label: string | null;
    team: number | null;
    team_label: string;
    type: number;
    type_label: string;
    status: number;
    enable_notification: number;
}
