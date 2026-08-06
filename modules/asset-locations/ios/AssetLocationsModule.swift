import ExpoModulesCore
import Photos
import UIKit

public class AssetLocationsModule: Module {
  private var backgroundTaskId: UIBackgroundTaskIdentifier = .invalid

  public func definition() -> ModuleDefinition {
    Name("AssetLocations")

    // Batch PHAsset.location — never opens image bytes / EXIF files.
    AsyncFunction("getAssetLocationsAsync") { (ids: [String]) -> [[String: Any]] in
      guard !ids.isEmpty else {
        return []
      }

      let fetch = PHAsset.fetchAssets(withLocalIdentifiers: ids, options: nil)
      var byId: [String: [String: Any]] = [:]
      byId.reserveCapacity(fetch.count)

      fetch.enumerateObjects { asset, _, _ in
        var row: [String: Any] = ["id": asset.localIdentifier]
        if let location = asset.location {
          row["latitude"] = location.coordinate.latitude
          row["longitude"] = location.coordinate.longitude
        }
        byId[asset.localIdentifier] = row
      }

      // Preserve input order; missing ids still get a row (no GPS).
      return ids.map { id in
        byId[id] ?? ["id": id]
      }
    }

    // Extra wall-clock after resign-active so stamp geocode can finish a slice.
    // OS still expires this (often ~30s); JS resume picks up afterward.
    Function("beginBackgroundWork") { (name: String) -> Bool in
      self.beginBackgroundWorkOnMain(name: name)
    }

    Function("endBackgroundWork") { () in
      self.endBackgroundWorkOnMain()
    }
  }

  private func beginBackgroundWorkOnMain(name: String) -> Bool {
    let run: () -> Bool = {
      if self.backgroundTaskId != .invalid {
        return true
      }
      self.backgroundTaskId = UIApplication.shared.beginBackgroundTask(withName: name) {
        self.endBackgroundWorkOnMain()
      }
      return self.backgroundTaskId != .invalid
    }
    if Thread.isMainThread {
      return run()
    }
    return DispatchQueue.main.sync(execute: run)
  }

  private func endBackgroundWorkOnMain() {
    let run: () -> Void = {
      guard self.backgroundTaskId != .invalid else {
        return
      }
      let id = self.backgroundTaskId
      self.backgroundTaskId = .invalid
      UIApplication.shared.endBackgroundTask(id)
    }
    if Thread.isMainThread {
      run()
    } else {
      DispatchQueue.main.sync(execute: run)
    }
  }
}
