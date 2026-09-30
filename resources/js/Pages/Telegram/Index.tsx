import Card from '@/Components/ui/Card';
import DataTable, { EmptyRow } from '@/Components/ui/DataTable';
import AppLayout from '@/Layouts/AppLayout';
import { breadcrumbFrom } from '@/lib/breadcrumbs';
import type { BreadcrumbProps } from '@/types';

interface TelegramMessage {
    name: string;
    chat_id: number;
    date: string;
    text: string;
}

interface TelegramIndexProps extends BreadcrumbProps {
    messages: TelegramMessage[];
}

/** Recent messages to the bot, to look up a user's Telegram chat ID. */
export default function TelegramIndex({ messages, ...breadcrumb }: TelegramIndexProps) {
    return (
        <AppLayout title="Telegram Chat ID" breadcrumb={breadcrumbFrom(breadcrumb)}>
            <Card>
                <DataTable>
                    <thead>
                        <tr>
                            <th style={{ width: '5%' }}>#</th>
                            <th>Date</th>
                            <th>Name</th>
                            <th>Chat ID</th>
                            <th>Message</th>
                        </tr>
                    </thead>
                    <tbody>
                        {messages.map((message, index) => (
                            <tr key={index}>
                                <td>{index + 1}</td>
                                <td>{message.date}</td>
                                <td>{message.name}</td>
                                <td>{message.chat_id}</td>
                                <td>{message.text}</td>
                            </tr>
                        ))}
                        {messages.length === 0 && <EmptyRow colSpan={5}>No recent messages.</EmptyRow>}
                    </tbody>
                </DataTable>
            </Card>
        </AppLayout>
    );
}
