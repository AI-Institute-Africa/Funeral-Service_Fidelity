import { useState, type FormEvent } from 'react'
import { env } from '@/lib/env'
import './policy-import.css'

type Layout = 'policy-per-row' | 'member-per-row'
type ImportIssue = { row: number; field: string; message: string }
type Preview = {
  batchId: string
  fileName: string
  layout: Layout
  rowsRead: number
  policiesAdded: number
  policiesUpdated: number
  expiresAt: string
  preview: { policyNumber: string; holderName: string; planName: string; status: string; coveredMembers: number; action: 'add' | 'update' }[]
}

async function responseError(response: Response): Promise<{ message?: string; issues?: ImportIssue[] }> {
  try {
    return await response.json() as { message?: string; issues?: ImportIssue[] }
  } catch {
    return { message: `Request failed (${response.status}).` }
  }
}

export default function PolicyImportPage() {
  const [layout, setLayout] = useState<Layout>('policy-per-row')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [issues, setIssues] = useState<ImportIssue[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const downloadTemplate = async () => {
    setError('')
    try {
      const response = await fetch(`${env.apiBaseUrl}/admin/policies/import/template?layout=${layout}`, { credentials: 'same-origin' })
      if (!response.ok) {
        setError((await responseError(response)).message ?? 'Could not download the workbook template.')
        return
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `fidelity-policy-template-${layout}.xlsx`
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      setError('Could not reach the policy import service. Check the connection and try again.')
    }
  }

  const uploadWorkbook = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!file) {
      setError('Choose an .xlsx workbook to preview.')
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    setIssues([])
    setPreview(null)
    const body = new FormData()
    body.set('layout', layout)
    body.set('workbook', file)
    try {
      const response = await fetch(`${env.apiBaseUrl}/admin/policies/import/preview`, {
        method: 'POST',
        credentials: 'same-origin',
        body,
      })
      if (!response.ok) {
        const result = await responseError(response)
        setError(result.message ?? 'The workbook could not be previewed.')
        setIssues(result.issues ?? [])
        return
      }
      setPreview(await response.json() as Preview)
    } catch {
      setError('Could not reach the policy import service. Check the connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  const commitImport = async () => {
    if (!preview) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch(`${env.apiBaseUrl}/admin/policies/import/${encodeURIComponent(preview.batchId)}/commit`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      })
      if (!response.ok) {
        setError((await responseError(response)).message ?? 'The policy import could not be committed.')
        return
      }
      const result = await response.json() as { policiesAdded: number; policiesUpdated: number }
      setNotice(`Import complete: ${result.policiesAdded} policies added and ${result.policiesUpdated} updated.`)
      setPreview(null)
      setFile(null)
    } catch {
      setError('Could not reach the policy import service. Check the connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-stack policy-import">
      <header className="page-head reveal">
        <p className="eyebrow">Admin operations · policy records</p>
        <h1>Import policy workbook</h1>
        <p className="muted page-head__lead">Upload and validate an Excel file, review the merge summary, then confirm the import. Policy data is available for authenticated account lookup after import.</p>
      </header>

      <div className="policy-import__notice" role="note">
        <strong>Protected import</strong>
        <span>Only signed-in administrators can upload or commit policy data. Workbook content is staged for 30 minutes and removed from the staged payload after a successful import. Use approved, access-controlled devices and do not email workbooks.</span>
      </div>
      {env.useMock && <p className="policy-import__error" role="status">Policy imports are disabled in demo mode. Set <code>VITE_API_MODE=live</code> and connect the backend to use this feature; demo uploads are not saved.</p>}

      <form className="card policy-import__form" onSubmit={(event) => void uploadWorkbook(event)}>
        <div className="policy-import__controls">
          <label className="field">
            <span className="field__label">Workbook layout</span>
            <select className="select" value={layout} onChange={(event) => {
              setLayout(event.target.value as Layout)
              setPreview(null)
              setIssues([])
              setError('')
            }}>
              <option value="policy-per-row">One row per policy</option>
              <option value="member-per-row">One row per covered member</option>
            </select>
          </label>
          <button type="button" className="btn btn--outline" onClick={() => void downloadTemplate()} disabled={busy || env.useMock}>Download Excel template</button>
        </div>

        <div className="policy-import__layout-help">
          {layout === 'policy-per-row'
            ? <p>Use one row for each policy. Put family members in <code>covered_members</code> as <code>Name|Relationship|Share</code>, separating members with semicolons. Example: <code>Rudo Ncube|Mother|100</code>.</p>
            : <p>Use one row per covered family member. Repeat the policy details on each member row; member rows for a policy must match. If shares are used, they must total 100 for that policy.</p>}
        </div>

        <label className="field">
          <span className="field__label">Excel workbook (.xlsx)</span>
          <input className="input" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={env.useMock} onChange={(event) => {
            setFile(event.target.files?.[0] ?? null)
            setPreview(null)
            setIssues([])
            setError('')
          }} />
        </label>
        {error && <p className="policy-import__error" role="alert">{error}</p>}
        {notice && <p className="policy-import__success" role="status">{notice}</p>}
        {issues.length > 0 && (
          <section className="policy-import__issues" aria-label="Workbook issues">
            <h2>Fix these workbook issues</h2>
            <ul>{issues.map((issue, index) => <li key={`${issue.row}-${issue.field}-${index}`}><strong>Row {issue.row} · {issue.field}:</strong> {issue.message}</li>)}</ul>
          </section>
        )}
        <button className="btn btn--primary" type="submit" disabled={busy || !file || env.useMock}>{busy ? 'Validating…' : 'Validate and preview'}</button>
      </form>

      {preview && (
        <section className="card policy-import__preview" aria-labelledby="policy-preview-title">
          <div className="policy-import__preview-heading">
            <div><p className="eyebrow">Review before applying</p><h2 id="policy-preview-title">{preview.fileName}</h2></div>
            <span>Preview expires {new Date(preview.expiresAt).toLocaleTimeString()}</span>
          </div>
          <div className="policy-import__summary">
            <p><strong>{preview.rowsRead}</strong><span>rows read</span></p>
            <p><strong>{preview.policiesAdded}</strong><span>new policies</span></p>
            <p><strong>{preview.policiesUpdated}</strong><span>policies to update</span></p>
          </div>
          <p>Existing policy numbers will be updated; new policy numbers will be added. Policies not in this workbook will be left unchanged.</p>
          {preview.preview.length > 0 && (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Policy number</th><th>Holder</th><th>Plan</th><th>Status</th><th>Members</th><th>Import action</th></tr></thead>
                <tbody>{preview.preview.map((item) => (
                  <tr key={item.policyNumber}>
                    <td data-label="Policy number">{item.policyNumber}</td>
                    <td data-label="Holder">{item.holderName}</td>
                    <td data-label="Plan">{item.planName}</td>
                    <td data-label="Status">{item.status}</td>
                    <td data-label="Members">{item.coveredMembers}</td>
                    <td data-label="Import action">{item.action === 'add' ? 'Add' : 'Update'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          {preview.policiesAdded + preview.policiesUpdated > preview.preview.length && <p className="muted">Showing the first {preview.preview.length} policy records; all {preview.policiesAdded + preview.policiesUpdated} records are included in the preview totals.</p>}
          <div className="policy-import__actions">
            <button type="button" className="btn btn--primary" onClick={() => void commitImport()} disabled={busy}>{busy ? 'Importing…' : 'Confirm policy import'}</button>
            <button type="button" className="btn btn--outline" onClick={() => setPreview(null)} disabled={busy}>Cancel preview</button>
          </div>
        </section>
      )}
    </div>
  )
}
