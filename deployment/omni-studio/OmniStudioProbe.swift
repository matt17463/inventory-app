import AppKit
import ApplicationServices
import Foundation

struct Reading: Codable {
    let uv_head_1_c: Double
    let uv_head_2_c: Double
    let uv_head_1_mode: String
    let uv_head_2_mode: String
    let ambient_c: Double?
    let humidity_pct: Double?
    let moisturizing_liquid_1_pct: Double?
    let moisturizing_liquid_2_pct: Double?
}

struct Snapshot: Codable {
    let captured_at: Date
    let state: String
    let readings: Reading?
    let reason: String?
    var diagnostics: [String]? = nil
    var connection_confirmed: Bool? = nil
}

func parseHealth(_ content: [String]) -> Reading? {
    let lines = content.map { $0.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }
    guard lines.contains("device health"),
          lines.contains("dual uv"),
          !lines.contains("not connected"),
          let uv1 = lines.firstIndex(of: "uv 1"),
          let uv2 = lines[lines.index(after: uv1)...].firstIndex(of: "uv 2"),
          let environment = lines[lines.index(after: uv2)...].firstIndex(of: "environment")
    else { return nil }

    func number(_ raw: String, unit: String, within range: ClosedRange<Double>) -> Double? {
        guard raw.hasSuffix(unit) else { return nil }
        let text = raw.dropLast(unit.count).trimmingCharacters(in: .whitespaces)
        guard let result = Double(text.replacingOccurrences(of: ",", with: ".")),
              range.contains(result)
        else { return nil }
        return result
    }

    let modeLabels = ["working mode": "normal", "sleep mode": "sleep",
                      "sleeping mode": "sleep", "vacation mode": "vacation"]
    func head(_ section: ArraySlice<String>) -> (Double, String)? {
        let temperatures = section.compactMap { number($0, unit: "°c", within: -20...120) }
        let modes = section.compactMap { modeLabels[$0] }
        guard !temperatures.isEmpty, Set(temperatures).count == 1,
              !modes.isEmpty, Set(modes).count == 1 else { return nil }
        return (temperatures[0], modes[0])
    }
    guard let first = head(lines[uv1..<uv2]), let second = head(lines[uv2..<environment]) else { return nil }

    let remainder = lines[environment...]
    func optional(_ label: String, unit: String, range: ClosedRange<Double>) -> Double? {
        guard let position = remainder.firstIndex(of: label),
              position + 1 < lines.count else { return nil }
        return number(lines[position + 1], unit: unit, within: range)
    }
    return Reading(uv_head_1_c: first.0, uv_head_2_c: second.0,
                   uv_head_1_mode: first.1, uv_head_2_mode: second.1,
                   ambient_c: optional("temperature", unit: "°c", range: -30...100),
                   humidity_pct: optional("humidity", unit: "%", range: 0...100),
                   moisturizing_liquid_1_pct: optional("uv 1 moisturizing liquid", unit: "%", range: 0...100),
                   moisturizing_liquid_2_pct: optional("uv 2 moisturizing liquid", unit: "%", range: 0...100))
}

func attribute(_ element: AXUIElement, _ name: String) -> CFTypeRef? {
    var value: CFTypeRef?
    return AXUIElementCopyAttributeValue(element, name as CFString, &value) == .success ? value : nil
}

func healthSnapshot() -> Snapshot {
    func unavailable(_ reason: String) -> Snapshot {
        Snapshot(captured_at: Date(), state: "unavailable", readings: nil, reason: reason)
    }
    guard AXIsProcessTrusted() else { return unavailable("Accessibility access is required for this probe.") }
    guard let app = NSWorkspace.shared.frontmostApplication,
          app.bundleIdentifier == "com.makeblock.xtool-studio",
          !app.isHidden else { return unavailable("Bring xTool Studio to the foreground.") }
    let root = AXUIElementCreateApplication(app.processIdentifier)
    AXUIElementSetMessagingTimeout(root, 0.5)
    guard let windows = attribute(root, kAXWindowsAttribute) as? [AXUIElement] else {
        return unavailable("Studio did not expose an accessible window.")
    }

    let anchors = ["device health", "dual uv", "ready", "not connected", "uv 1", "uv 2",
                   "environment", "working mode", "sleep mode", "sleeping mode", "vacation mode"]
    func normalized(_ text: String) -> String {
        text.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }
    func labels(_ element: AXUIElement) -> [String] {
        let role = attribute(element, kAXRoleAttribute) as? String ?? ""
        guard [kAXStaticTextRole, "AXHeading", kAXButtonRole, kAXGroupRole, "AXDialog",
               kAXTextFieldRole].contains(role) else { return [] }
        var seen: Set<String> = []
        return [kAXValueAttribute, kAXTitleAttribute, kAXDescriptionAttribute]
            .compactMap { attribute(element, $0) as? String }
            .filter { $0.count < 200 && seen.insert($0).inserted }
            .flatMap { $0.components(separatedBy: .newlines) }
    }
    func children(_ element: AXUIElement) -> [AXUIElement] {
        attribute(element, kAXChildrenAttribute) as? [AXUIElement] ?? []
    }
    func boundedChildren(_ element: AXUIElement) -> [AXUIElement] {
        let elements = children(element)
        if elements.count <= 80 { return elements }
        return Array(elements.prefix(24)) + Array(elements.suffix(32))
    }
    var candidates: [(Reading, Bool)] = []
    var diagnostics: [String] = []
    let deadline = ProcessInfo.processInfo.systemUptime + 25
    let discoveryDeadline = deadline - 12
    for window in windows where (attribute(window, kAXMinimizedAttribute) as? Bool) != true {
        // Use a breadth-first pass to find the modal without walking thousands of canvas elements.
        var queue = [window]
        var cursor = 0
        var windowSignals: Set<String> = []
        var panels: [AXUIElement] = []
        while cursor < queue.count && cursor < 4500 && ProcessInfo.processInfo.systemUptime < discoveryDeadline {
            let node = queue[cursor]
            cursor += 1
            let nodeLabels = labels(node).map(normalized)
            windowSignals.formUnion(nodeLabels.filter(anchors.contains))
            if nodeLabels.contains("device health"),
               (attribute(node, kAXRoleAttribute) as? String) != kAXButtonRole {
                var ancestor = node
                for _ in 0..<4 {
                    guard let parent = attribute(ancestor, kAXParentAttribute),
                          CFGetTypeID(parent) == AXUIElementGetTypeID() else { break }
                    ancestor = unsafeBitCast(parent, to: AXUIElement.self)
                    if CFEqual(ancestor, window) { break }
                    if !panels.contains(where: { CFEqual($0, ancestor) }) { panels.append(ancestor) }
                }
            }
            queue.append(contentsOf: boundedChildren(node))
        }
        var bestMatches: Set<String> = []
        var highestTemperatureCount = 0
        for panel in panels where ProcessInfo.processInfo.systemUptime < deadline {
            var stack = [panel]
            var content: [String] = []
            var visited = 0
            while let node = stack.popLast(), visited < 600, ProcessInfo.processInfo.systemUptime < deadline {
                visited += 1
                content.append(contentsOf: labels(node))
                stack.append(contentsOf: boundedChildren(node).reversed())
            }
            let signals = content.map(normalized)
            bestMatches.formUnion(signals.filter(anchors.contains))
            highestTemperatureCount = max(highestTemperatureCount, signals.filter { $0.hasSuffix("°c") }.count)
            if !windowSignals.contains("not connected"), let reading = parseHealth(content) {
                candidates.append((reading, windowSignals.contains("ready")))
                break
            }
        }
        diagnostics.append("Searched \(cursor) nodes; \(panels.count) candidate containers; \(highestTemperatureCount) temperature labels; matched: \(windowSignals.union(bestMatches).sorted().joined(separator: ", "))")
    }
    guard NSWorkspace.shared.frontmostApplication?.processIdentifier == app.processIdentifier else {
        return unavailable("Keep Studio in the foreground until the pilot finishes.")
    }
    guard candidates.count == 1 else {
        var result = unavailable("Studio’s accessibility data did not contain one complete Omni panel.")
        result.diagnostics = diagnostics
        return result
    }
    return Snapshot(captured_at: Date(), state: "pilot_snapshot", readings: candidates[0].0,
                    reason: nil, connection_confirmed: candidates[0].1)
}

let arguments = Array(CommandLine.arguments.dropFirst())
let standalone = Bundle.main.bundleIdentifier == "com.skilledcrafting.omnistudioprobe.v3"
let output: Snapshot
if standalone {
    Thread.sleep(forTimeInterval: 15)
    output = healthSnapshot()
} else if arguments.count == 2, arguments[0] == "--fixture" {
    let content = try JSONDecoder().decode([String].self, from: Data(contentsOf: URL(fileURLWithPath: arguments[1])))
    let reading = parseHealth(content)
    output = Snapshot(captured_at: Date(), state: reading == nil ? "unavailable" : "fixture", readings: reading, reason: nil)
} else if arguments.isEmpty || (arguments.count == 2 && arguments[0] == "--delay" && (0...60).contains(Int(arguments[1]) ?? -1)) {
    if arguments.count == 2, let delay = Int(arguments[1]) { Thread.sleep(forTimeInterval: Double(delay)) }
    output = healthSnapshot()
} else {
    FileHandle.standardError.write(Data("Usage: OmniStudioProbe [--delay seconds | --fixture file.json]\n".utf8))
    exit(2)
}
let encoder = JSONEncoder()
encoder.dateEncodingStrategy = .iso8601
encoder.outputFormatting = [.sortedKeys]
let encoded = try encoder.encode(output)
if standalone {
    let result = FileManager.default.homeDirectoryForCurrentUser
        .appendingPathComponent("Downloads/OmniStudioPilot3.json")
    try encoded.write(to: result, options: .atomic)
} else {
    print(String(decoding: encoded, as: UTF8.self))
}
