import Card from '@/Components/ui/Card';
import AppLayout from '@/Layouts/AppLayout';

interface CustomErrorProps {
    response: {
        title: string;
        message?: string[];
    };
}

/** The "access error" page controllers render when a user may not see something. */
export default function CustomError({ response }: CustomErrorProps) {
    return (
        <AppLayout title="Error">
            <Card>
                <h5 className="blink_me pb-3">
                    <i className="fa fa-exclamation-triangle text-danger me-1" />
                    {response.title}
                </h5>
                {response.message?.map((line, index) => (
                    <p key={index}>{line}</p>
                ))}
            </Card>
        </AppLayout>
    );
}
