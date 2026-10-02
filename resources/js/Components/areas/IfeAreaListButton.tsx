import { useState } from 'react';
import Button from '@/Components/ui/Button';
import Modal from '@/Components/ui/Modal';

interface IfeAreaListButtonProps {
    areas: { value: number; label: string; description: string | null }[];
    label?: string;
    /** Draw the trigger as a surface button (.rd-btn with a pin) instead of the Minible one. */
    surface?: boolean;
}

/** A button that opens the list of IFE area codes and what they cover. */
export default function IfeAreaListButton({
    areas,
    label = 'IFE Area Listing',
    surface = false,
}: IfeAreaListButtonProps) {
    const [open, setOpen] = useState(false);

    return (
        <>
            {surface ? (
                <button type="button" className="rd-btn rd-btn--lg" onClick={() => setOpen(true)}>
                    <i className="mdi mdi-map-marker-outline" aria-hidden="true" />
                    {label}
                </button>
            ) : (
                <Button size="sm" className="filter-button" onClick={() => setOpen(true)}>
                    {label}
                </Button>
            )}
            <Modal show={open} onHide={() => setOpen(false)} title="IFE Area Listing" size="lg">
                <table className="table table-sm table-bordered custom-font-small mb-0">
                    <thead className="table-dark">
                        <tr>
                            <th>Area Code</th>
                            <th>Description</th>
                        </tr>
                    </thead>
                    <tbody>
                        {areas.map((area) => (
                            <tr key={area.value}>
                                <td>{area.label}</td>
                                <td>{area.description}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Modal>
        </>
    );
}
