import React, { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, FlashMode, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Text } from '../components/Text';
import { Button } from '../components/Button';
import { useTheme } from '../design/theme';

/**
 * Capture: FR-3 (camera), FR-4 (gallery import), FR-5 (flash).
 *
 * Images are compressed here, on the phone, before they ever reach the
 * network (NFR Performance) — a modern phone photo is several megabytes and
 * would blow both the upload time and the server's size limit.
 */
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.7;

export async function compressForUpload(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: MAX_EDGE } }], {
    compress: JPEG_QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return result.uri;
}

export function CaptureScreen({
  onCaptured,
  onCancel,
}: {
  onCaptured: (uri: string) => void;
  onCancel: () => void;
}) {
  const { c, space, minTarget } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [flash, setFlash] = useState<FlashMode>('off');
  const [busy, setBusy] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const take = async () => {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 1, skipProcessing: true });
      if (photo?.uri) onCaptured(await compressForUpload(photo.uri));
    } finally {
      setBusy(false);
    }
  };

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (!res.canceled && res.assets[0]) {
      setBusy(true);
      try {
        onCaptured(await compressForUpload(res.assets[0].uri));
      } finally {
        setBusy(false);
      }
    }
  };

  if (!permission) {
    return <View style={{ flex: 1, backgroundColor: c.ground }} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.ground, padding: space.gutter, gap: space.lg, justifyContent: 'center' }}>
        <Text variant="displayM">Let SnapClaim use the camera</Text>
        <Text variant="body" tone="secondary">
          The camera is how you photograph a receipt. You can also import a photo you already took.
        </Text>
        <Button label="allow camera" onPress={requestPermission} />
        <Button label="import from gallery instead" variant="outline" onPress={pick} />
        <Button label="back" variant="quiet" onPress={onCancel} />
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" flash={flash} />

      <SafeAreaView
        edges={['bottom']}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.gutter, gap: space.base }}
      >
        <Text variant="micro" style={{ color: '#FBF8F1', textAlign: 'center' }}>
          fill the frame with the receipt
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable
            onPress={pick}
            accessibilityRole="button"
            accessibilityLabel="Import from gallery"
            style={{ minWidth: minTarget, minHeight: minTarget, justifyContent: 'center' }}
          >
            <Text variant="micro" style={{ color: '#FBF8F1' }}>
              gallery
            </Text>
          </Pressable>

          {/* Shutter: a ring, not a filled circle, so the receipt stays visible. */}
          <Pressable
            onPress={take}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Take a photo of the receipt"
            style={{
              width: 76,
              height: 76,
              borderRadius: 38,
              borderWidth: 4,
              borderColor: '#FBF8F1',
              backgroundColor: busy ? '#FBF8F155' : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#FBF8F1' }} />
          </Pressable>

          <Pressable
            onPress={() => setFlash((f) => (f === 'off' ? 'on' : 'off'))}
            accessibilityRole="button"
            accessibilityLabel={flash === 'off' ? 'Turn flash on' : 'Turn flash off'}
            accessibilityState={{ selected: flash === 'on' }}
            style={{ minWidth: minTarget, minHeight: minTarget, justifyContent: 'center', alignItems: 'flex-end' }}
          >
            <Text variant="micro" style={{ color: flash === 'on' ? c.warn : '#FBF8F1' }}>
              flash {flash}
            </Text>
          </Pressable>
        </View>
        <Button label="cancel" variant="quiet" onPress={onCancel} />
      </SafeAreaView>
    </View>
  );
}
