import { Modal } from '../ui/Modal'
import { changelog } from '../../data/changelog'

export function ChangelogModal({ onClose }: { onClose: () => void }) {
  return <Modal title="O que há de novo" onClose={onClose}>
    <div className="changelog-list">
      {changelog.map(entry => <div className="changelog-entry" key={entry.version}>
        <header><strong>v{entry.version}</strong><time>{entry.date}</time></header>
        <ul>{entry.items.map(item => <li key={item}>{item}</li>)}</ul>
      </div>)}
    </div>
  </Modal>
}
