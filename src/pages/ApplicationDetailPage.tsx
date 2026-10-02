import { Link, useParams } from 'react-router'

/** Placeholder until slice 1c-iii (documents, history, decisions). */
export function ApplicationDetailPage() {
  const { id } = useParams()
  return (
    <section>
      <p>
        <Link to="/applications">← Back to the queue</Link>
      </p>
      <h1>Application #{id}</h1>
      <p>The detail screen is built in the next slice.</p>
    </section>
  )
}
