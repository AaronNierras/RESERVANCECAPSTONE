import { Component } from 'react'
import client from '../api/client'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { message: '' }
  }

  static getDerivedStateFromError() {
    return { message: 'This page hit a problem. The rest of RESERVANCE is still available.' }
  }

  componentDidCatch(error) {
    const message = error?.message || 'Unexpected page error'
    client.post('/system-errors', {
      message: String(message).slice(0, 500),
      location: window.location.pathname,
    }).catch(() => {})
  }

  render() {
    if (!this.state.message) return this.props.children
    return (
      <div className="space-y-4 p-6">
        <p className="rounded-lg border border-[#5c297c]/20 bg-white p-4 font-semibold text-[#491464]">{this.state.message}</p>
        <button type="button" className="rounded-lg bg-[#ffb736] px-4 py-2 font-bold text-[#491464]" onClick={() => this.setState({ message: '' })}>
          Continue
        </button>
      </div>
    )
  }
}
