export function SidebarContainer() {
  const openSidePanel = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.windowId) {
      chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {})
    }
  }

  return (
    <button
      onClick={openSidePanel}
      className="fixed bottom-6 right-6 z-[2147483647] w-12 h-12 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 flex items-center justify-center text-xl font-bold transition-transform hover:scale-105 pointer-events-auto"
      title="OmniNotation">
      📝
    </button>
  )
}
