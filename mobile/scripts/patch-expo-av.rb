#!/usr/bin/env ruby
# Patches expo-av for compatibility with expo-modules-core 56+ (Swift rewrite).
#
# expo-modules-core 56 removed several legacy Objective-C protocols/interfaces
# that expo-av 15/16 still depends on. This script:
#   1. Removes the broken #import for EXEventEmitter.h
#   2. Provides stub protocol declarations for EXEventEmitterService and
#      EXLegacyExpoViewProtocol which are absent from ExpoModulesCore 56's
#      prebuilt xcframework.
#   3. Guards the sendEventWithName call so it doesn't crash at runtime when
#      no module implements EXEventEmitterService (as is the case with 56+).
#
# Run this ONCE before `pod install`, OR after `npm install` if expo-av changes:
#   ruby scripts/patch-expo-av.rb && cd ios && pod install

require 'fileutils'

EXPO_AV_ROOT = File.join(__dir__, '..', 'node_modules', 'expo-av', 'ios', 'EXAV')
STUBS_DIR    = File.join(__dir__, 'stubs', 'ExpoModulesCore')
FileUtils.mkdir_p(STUBS_DIR)

# ─── Stub 1: EXEventEmitterService.h ─────────────────────────────────────────
# Used in EXAV.m to get the module that handles event emission.
# In expo-modules-core 56+ this is done via Swift EventEmitter, so the protocol
# is gone. We provide a minimal stub so compilation succeeds; at runtime,
# getModuleImplementingProtocol returns nil and we guard against that.
stub_event_emitter_service = <<~HEADER
  // Copyright © 2024 Local. All rights reserved.
  // Compatibility stub for expo-modules-core 56+.
  // In SDK 56+ event emission is handled by the Swift EventEmitter layer.
  #import <Foundation/Foundation.h>
  @class EXModuleRegistry;

  NS_ASSUME_NONNULL_BEGIN

  @protocol EXEventEmitterService <NSObject>
  - (void)sendEventWithName:(NSString *)eventName body:(nullable id)body;
  @end

  NS_ASSUME_NONNULL_END
HEADER

# ─── Stub 2: EXLegacyExpoViewProtocol.h ─────────────────────────────────────
# Used in EXVideoView.h as a protocol conformance for the legacy view system.
# expo-modules-core 56 uses Fabric/TurboModules for new views.
# We provide an empty protocol so compilation succeeds.
stub_legacy_expo_view_protocol = <<~HEADER
  // Copyright © 2024 Local. All rights reserved.
  // Compatibility stub for expo-modules-core 56+.
  // In SDK 56+ the legacy view protocol is replaced by the new architecture.
  #import <UIKit/UIKit.h>

  NS_ASSUME_NONNULL_BEGIN

  @protocol EXLegacyExpoViewProtocol <NSObject>
  @optional
  - (void)updateProps:(NSDictionary *)props;
  @end

  NS_ASSUME_NONNULL_END
HEADER

File.write(File.join(STUBS_DIR, 'EXEventEmitterService.h'), stub_event_emitter_service)
File.write(File.join(STUBS_DIR, 'EXLegacyExpoViewProtocol.h'), stub_legacy_expo_view_protocol)
puts "Wrote stub headers to #{STUBS_DIR}"

# ─── Patch EXAV.h ─────────────────────────────────────────────────────────────
av_h = File.join(EXPO_AV_ROOT, 'EXAV.h')
backup = av_h + '.unpatched'

unless File.exist?(av_h)
  puts "EXAV.h not found at #{av_h}, skipping"
else
  content = File.read(av_h)
  if content.include?('// PATCHED: EXEventEmitter removed')
    puts "EXAV.h already patched, skipping"
  else
    FileUtils.cp(av_h, backup) if File.exist?(av_h) && !File.exist?(backup)
    content = content.gsub(%r{#import <ExpoModulesCore/EXEventEmitter\.h>\n}, "// PATCHED: EXEventEmitter removed (compat with expo-modules-core 56+)\n")
    content = content.gsub(/,\s*EXEventEmitter/, '')
    File.write(av_h, content)
    puts "Patched EXAV.h — removed EXEventEmitter import and conformance"
  end
end

# ─── Patch EXAV.m ─────────────────────────────────────────────────────────────
av_m = File.join(EXPO_AV_ROOT, 'EXAV.m')
backup_m = av_m + '.unpatched'

unless File.exist?(av_m)
  puts "EXAV.m not found at #{av_m}, skipping"
else
  content = File.read(av_m)
  if content.include?('// PATCHED: sendEventWithName guarded')
    puts "EXAV.m already patched, skipping"
  else
    FileUtils.cp(av_m, backup_m) if !File.exist?(backup_m)
    old = '[[_expoModuleRegistry getModuleImplementingProtocol:@protocol(EXEventEmitterService)] sendEventWithName:eventName body:body]'
    replacement = <<~REPLACEMENT
      do { \\
          id<EXEventEmitterService> emitter = [_expoModuleRegistry getModuleImplementingProtocol:@protocol(EXEventEmitterService)]; \\
          /* PATCHED: sendEventWithName guarded (compat with expo-modules-core 56+) */ \\
          if ([emitter respondsToSelector:@selector(sendEventWithName:body:)]) { \\
              [emitter sendEventWithName:eventName body:body]; \\
          } \\
      } while (0)
    REPLACEMENT
    content = content.gsub(old, replacement)
    File.write(av_m, content)
    puts "Patched EXAV.m — guarded sendEventWithName call"
  end
end

# ─── Patch EXAVTV.m (same pattern) ───────────────────────────────────────────
av_tv_m = File.join(EXPO_AV_ROOT, 'EXAVTV.m')
backup_tv_m = av_tv_m + '.unpatched'

if File.exist?(av_tv_m)
  content = File.read(av_tv_m)
  if !content.include?('// PATCHED: sendEventWithName guarded')
    FileUtils.cp(av_tv_m, backup_tv_m) if !File.exist?(backup_tv_m)
    old = '[[_expoModuleRegistry getModuleImplementingProtocol:@protocol(EXEventEmitterService)] sendEventWithName:eventName body:body]'
    replacement = <<~REPLACEMENT
      do { \\
          id<EXEventEmitterService> emitter = [_expoModuleRegistry getModuleImplementingProtocol:@protocol(EXEventEmitterService)]; \\
          /* PATCHED: sendEventWithName guarded (compat with expo-modules-core 56+) */ \\
          if ([emitter respondsToSelector:@selector(sendEventWithName:body:)]) { \\
              [emitter sendEventWithName:eventName body:body]; \\
          } \\
      } while (0)
    REPLACEMENT
    content = content.gsub(old, replacement)
    File.write(av_tv_m, content)
    puts "Patched EXAVTV.m — guarded sendEventWithName call"
  else
    puts "EXAVTV.m already patched, skipping"
  end
end

puts "\nDone. Run `cd ios && pod install` to update Pods."
puts "If you need to restore originals: node_modules/expo-av/ios/EXAV/*.unpatched"