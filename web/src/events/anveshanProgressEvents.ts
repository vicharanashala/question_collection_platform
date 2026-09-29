type Listener = () => void
const listeners = new Set<Listener>()

// Lets screens showing Anveshan milestone progress reload it after the user submits a question, record or answer.
export const anveshanProgressEmitter = {
  on(listener: Listener) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  emit() {
    listeners.forEach((listener) => listener())
  },
}
