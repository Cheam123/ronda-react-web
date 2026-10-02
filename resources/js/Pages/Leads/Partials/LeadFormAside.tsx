/** The notes beside the lead form: what makes a customer, what feeds suggested orders. */
export default function LeadFormAside({ customerId }: { customerId: string }) {
    const customer = customerId.trim() !== '';

    return (
        <aside className="rd-form-page__aside">
            <section className="rd-panel" aria-labelledby="kind-title">
                <div className="lead-card__head">
                    <h2 id="kind-title" className="rd-panel__title">
                        Customer or prospect
                    </h2>
                    {customer ? (
                        <span className="rd-chip rd-chip--good">
                            <span className="rd-dot" />
                            Customer
                        </span>
                    ) : (
                        <span className="rd-chip rd-chip--serious">
                            <span className="rd-dot" />
                            Prospect
                        </span>
                    )}
                </div>
                <p className="lead-note">An outlet is a customer once it has a Customer ID.</p>
                <ul className="rd-checks">
                    <li>
                        <i className="mdi mdi-check is-good" aria-hidden="true" />A customer can have any number of open
                        tasks.
                    </li>
                    <li>
                        <i className="mdi mdi-alert-circle-outline lead-note__warn" aria-hidden="true" />A prospect has
                        one open task at a time.
                    </li>
                </ul>
            </section>
            <section className="rd-panel" aria-labelledby="suggestions-title">
                <h2 id="suggestions-title" className="rd-panel__title">
                    Suggested orders
                </h2>
                <p className="lead-note">
                    Size, seats, segment and the location are what the suggestions compare. Change any of them and this
                    outlet’s suggestions are worked out again.
                </p>
            </section>
        </aside>
    );
}
