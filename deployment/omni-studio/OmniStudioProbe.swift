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
}

func parseHealth(_ content: [String]) -> Reading? {
    let lines = content.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
    guard lines.contains("Device health"),
          lines.contains("Dual UV"),
          lines.contains("Ready"),
          !lines.contains("Not connected"),
          let uv1 = lines.firstIndex(of: "UV 1"),
          let uv2 = lines[lines.index(after: uv1)...].firstIndex(of: "UV 2"),
          let environment = lines[lines.index(after: uv2)...].firstIndex(of: "Environment")
    else { return nil }

    func number(_ raw: String, unit: String, within range: ClosedRange<Double>) -> Double? {
        guard raw.hasSuffix(unit) else { return nil }
        let text = raw.dropLast(unit.count).trimmingCharacters(in: .whitespaces)
        guard let result = Double(text.replacingOccurrences(of: ",", with: ".")),
              range.contains(result)
        else { return nil }
        return result
    }

    let modeLabels = ["Working mode": "normal", "Sleep mode": "sleep",
                      "Sleeping mode": "sleep", "Vacation mode": "vacation"]
    func head(_ section: ArraySlice<String>) -> (Double, String)? {
        let temperatures = section.compactMap { number($0, unit: "°C", within: -20...120) }
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
                   ambient_c: optional("Temperature", unit: "°C", range: -30...100),
                   humidity_pct: optional("Humidity", unit: "%", range: 0...100),
                   moisturizing_liquid_1_pct: optional("UV 1 Moisturizing liquid", unit: "%", range: 0...100),
                   moisturizing_liquid_2_pct: optional("UV 2 Moisturizing liquid", unit: "%", range: 0...100))
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

    var candidates: [Reading] = []
    for window in windows where (attribute(window, kAXMinimizedAttribute) as? Bool) != true {
        var stack = [window]
        var content: [String] = []
        var visited = 0
        while let node = stack.popLast(), visited < 1500 {
            visited += 1
            let role = attribute(node, kAXRoleAttribute) as? String
            if [kAXStaticTextRole, "AXHeading"].contains(role ?? "") {
                if let text = (attribute(node, kAXValueAttribute) ?? attribute(node, kAXTitleAttribute)) as? String,
                   text.count < 200 {
                    content.append(contentsOf: text.components(separatedBy: .newlines))
                }
            }
            if let children = attribute(node, kAXChildrenAttribute) as? [AXUIElement] {
                stack.append(contentsOf: children.reversed())
            }
        }
        if let reading = parseHealth(content) { candidates.append(reading) }
    }
    guard candidates.count == 1 else {
        return unavailable("Open the connected Omni’s Device Health Overview with both UV heads visible.")
    }
    return Snapshot(captured_at: Date(), state: "pilot_snapshot", readings: candidates[0], reason: nil)
}

let arguments = Array(CommandLine.arguments.dropFirst())
let standalone = Bundle.main.bundleIdentifier == "com.skilledcrafting.omnistudioprobe"
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
        .appendingPathComponent("Downloads/OmniStudioResult.json")
    try encoded.write(to: result, options: .atomic)
} else {
    print(String(decoding: encoded, as: UTF8.self))
}
