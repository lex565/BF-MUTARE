import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import {
  DOCUMENT_FOR,
  PHOTO_OPTIONS,
  PROVIDER_TYPES,
  getApplication,
  saveApplication,
  startApplication,
  submitApplication,
  uploadDocument,
  type ApplicationState,
  type ProviderType,
} from './businessApi';

/**
 * Registering a business, from the phone, for real.
 *
 * WHAT WAS HERE BEFORE. Three screens of inputs that were never read, ending in
 * `Alert.alert('Preview submitted')`. Nothing was written anywhere. Somebody
 * who filled it in believed they had applied; nothing reached the review queue;
 * and neither side knew. The applicant concluded Musuwo was ignoring them, and
 * Musuwo never learned they existed. That is the worst failure a pilot can
 * have, because it is invisible from both ends.
 *
 * THE RULES LIVE ON THE SERVER, NOT HERE. This screen asks what is required,
 * draws it, and asks again after every save. It does not decide anything: the
 * same `readiness` that governs the website governs this, so the phone cannot
 * accept an application the website would refuse.
 *
 * STARTING IS ONE QUESTION. Somebody standing in a market with no documents on
 * them can begin, see exactly what is needed, and come back. That is the whole
 * reason the draft exists.
 */

const GREEN = '#005029';
const ORANGE = '#f25c13';
const PAPER = '#f7f5ef';
const INK = '#12271b';
const SOFT = '#46584c';
const RULE = '#d5d3c5';

type Props = { token: string; onDone: () => void };

export function BusinessApplication({ token, onDone }: Props) {
  const [state, setState] = useState<ApplicationState | null>(null);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const next = await getApplication(token);
      setState(next);
      if (next.application) {
        const seed: Record<string, string> = {};
        for (const [k, v] of Object.entries(next.application)) {
          if (typeof v === 'string') seed[k] = v;
        }
        setFields(seed);
      }
    } catch (error) {
      Alert.alert('Could not load', (error as Error).message);
    } finally {
      setBusy(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const choose = async (providerType: ProviderType) => {
    setBusy(true);
    try {
      await startApplication(token, providerType);
      await load();
    } catch (error) {
      Alert.alert('Could not start', (error as Error).message);
      setBusy(false);
    }
  };

  const save = async () => {
    if (!state?.application) return;
    setSaving(true);
    try {
      await saveApplication(token, state.application.id, fields);
      await load();
      Alert.alert('Saved', 'You can close the app and come back to this.');
    } catch (error) {
      Alert.alert('Could not save', (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Take or choose a photo, then send it.
   *
   * Camera FIRST, because these are documents in somebody's hand rather than
   * files on their phone. `PHOTO_OPTIONS` compresses at capture - see the note
   * in businessApi.ts about why nothing resizes afterwards.
   */
  const addPhoto = async (kind: string) => {
    if (!state?.application) return;

    const permission = await ImagePicker.requestCameraPermissionsAsync();
    const result = permission.granted
      ? await ImagePicker.launchCameraAsync(PHOTO_OPTIONS)
      : await ImagePicker.launchImageLibraryAsync(PHOTO_OPTIONS);

    if (result.canceled || !result.assets?.[0]?.uri) return;

    setSaving(true);
    try {
      await uploadDocument({
        token,
        applicationId: state.application.id,
        kind,
        uri: result.assets[0].uri,
      });
      await load();
    } catch (error) {
      Alert.alert('That did not upload', (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const send = async () => {
    if (!state?.application) return;
    setSaving(true);
    try {
      await submitApplication(token, state.application.id);
      Alert.alert(
        'Sent to Musuwo',
        'A person reads every application. We will come back to you, and if anything is missing we will say exactly what.',
        [{ text: 'Good', onPress: onDone }],
      );
      await load();
    } catch (error) {
      // The server refuses an incomplete application whatever this screen
      // believed, and names what is missing.
      Alert.alert('Not quite ready', (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (busy) {
    return (
      <View style={{ flex: 1, backgroundColor: PAPER, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={GREEN} />
      </View>
    );
  }

  /* ------------------------------------------------------- choose a type */

  if (!state?.application) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: PAPER }} contentContainerStyle={{ padding: 20 }}>
        <Text style={{ fontSize: 12, letterSpacing: 2, color: ORANGE, fontWeight: '700' }}>
          MUSUWO FOR BUSINESS
        </Text>
        <Text style={{ fontSize: 30, fontWeight: '800', color: INK, marginTop: 10, lineHeight: 34 }}>
          Put your business on Musuwo
        </Text>
        <Text style={{ fontSize: 15, color: SOFT, marginTop: 12, lineHeight: 22 }}>
          One question to begin. You do not need any documents yet — you will
          see exactly what is needed once you choose, and you can come back to
          it.
        </Text>

        {PROVIDER_TYPES.map((t) => (
          <Pressable
            key={t.value}
            onPress={() => void choose(t.value)}
            style={{ borderWidth: 1, borderColor: RULE, backgroundColor: '#fff', padding: 18, borderRadius: 10, marginTop: 12 }}
          >
            <Text style={{ fontSize: 17, fontWeight: '700', color: INK }}>{t.label}</Text>
            <Text style={{ fontSize: 14, color: SOFT, marginTop: 6, lineHeight: 20 }}>{t.blurb}</Text>
          </Pressable>
        ))}
      </ScrollView>
    );
  }

  /* -------------------------------------------------------- already sent */

  const status = state.application.status;
  if (status !== 'DRAFT' && status !== 'NEEDS_INFORMATION') {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: PAPER }} contentContainerStyle={{ padding: 20 }}>
        <Text style={{ fontSize: 26, fontWeight: '800', color: INK }}>It is with Musuwo</Text>
        <Text style={{ fontSize: 15, color: SOFT, marginTop: 12, lineHeight: 22 }}>
          A person reads every application. We will come back to you, and if
          something is missing we will say exactly what.
        </Text>
        <Text style={{ fontSize: 12, letterSpacing: 1.5, color: SOFT, marginTop: 18 }}>
          STATUS: {status.replace(/_/g, ' ')}
        </Text>
      </ScrollView>
    );
  }

  const ready = state.readiness;
  const have = new Set(state.documents);
  const needs = new Set(ready?.requirements.map((r) => r.requirement) ?? []);

  const field = (key: string, label: string, placeholder?: string, multiline = false) =>
    needs.size === 0 || true ? (
      <View key={key} style={{ marginTop: 16 }}>
        <Text style={{ fontSize: 11, letterSpacing: 1.4, color: SOFT, fontWeight: '700' }}>
          {label.toUpperCase()}
        </Text>
        <TextInput
          value={fields[key] ?? ''}
          onChangeText={(v) => setFields((f) => ({ ...f, [key]: v }))}
          placeholder={placeholder}
          placeholderTextColor="#9aa79e"
          multiline={multiline}
          style={{
            borderWidth: 1, borderColor: RULE, backgroundColor: '#fff',
            paddingHorizontal: 14, paddingVertical: 12, marginTop: 6,
            fontSize: 16, color: INK, minHeight: multiline ? 80 : undefined,
          }}
        />
      </View>
    ) : null;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: PAPER }} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
      {state.application.infoRequested ? (
        <View style={{ borderLeftWidth: 4, borderLeftColor: ORANGE, backgroundColor: '#fbe6da', padding: 14, marginBottom: 18 }}>
          <Text style={{ fontWeight: '700', color: INK }}>Musuwo asked for something</Text>
          <Text style={{ color: INK, marginTop: 6, lineHeight: 20 }}>
            {state.application.infoRequested}
          </Text>
        </View>
      ) : null}

      <Text style={{ fontSize: 24, fontWeight: '800', color: INK }}>Your application</Text>

      {ready ? (
        <View style={{ backgroundColor: '#eceade', padding: 16, borderRadius: 10, marginTop: 14 }}>
          <Text style={{ fontWeight: '700', color: INK }}>
            {ready.canSubmit ? 'Everything is here.' : `${ready.missing.length} still to go`}
          </Text>
          {ready.requirements.map((r) => (
            <Text key={r.requirement} style={{ marginTop: 8, color: r.met ? '#7c8a80' : INK, fontSize: 14 }}>
              {r.met ? '✓ ' : '○ '}
              {r.label}
              {!r.isMandatory ? '  (optional)' : ''}
            </Text>
          ))}
        </View>
      ) : null}

      {field('businessName', 'What you want to be called', 'The name customers see')}
      {field('summary', 'In a sentence, what do you offer?', 'Fresh bread, baked every morning.', true)}
      {needs.has('operating_area') ? field('operatingArea', 'Where do you trade?', 'Sakubva and town') : null}
      {field('contactPhone', 'Phone', '+263 77 000 0000')}
      {field('whatsapp', 'WhatsApp, if different')}
      {field('contactEmail', 'Email')}
      {needs.has('legal_name') ? field('legalName', 'Full name, as on your ID') : null}
      {needs.has('legal_name') ? field('idNumber', 'ID number') : null}
      {needs.has('registration_number') ? field('registrationNumber', 'Company registration number') : null}
      {needs.has('address') ? field('residentialAddress', 'Where you live', 'Never shown to customers', true) : null}

      <Pressable
        onPress={() => void save()}
        disabled={saving}
        style={{ backgroundColor: GREEN, padding: 16, marginTop: 22, opacity: saving ? 0.6 : 1 }}
      >
        <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700', letterSpacing: 1.2 }}>
          {saving ? 'WORKING…' : 'SAVE WHAT I HAVE'}
        </Text>
      </Pressable>

      {/* ------------------------------------------------------ documents */}
      <Text style={{ fontSize: 20, fontWeight: '800', color: INK, marginTop: 30 }}>Photos</Text>
      <Text style={{ fontSize: 14, color: SOFT, marginTop: 6, lineHeight: 20 }}>
        Taken on this phone is fine. These go somewhere only Musuwo reviewers
        can open — never public, never shown to customers.
      </Text>

      {(ready?.requirements ?? [])
        .filter((r) => DOCUMENT_FOR[r.requirement])
        .map((r) => {
          const kind = DOCUMENT_FOR[r.requirement];
          const done = have.has(kind);
          return (
            <Pressable
              key={r.requirement}
              onPress={() => void addPhoto(kind)}
              disabled={saving}
              style={{ borderWidth: 1, borderColor: done ? GREEN : RULE, backgroundColor: '#fff', padding: 16, marginTop: 12 }}
            >
              <Text style={{ fontWeight: '700', color: INK }}>
                {done ? '✓ ' : ''}
                {r.label}
                {!r.isMandatory ? '  (optional)' : ''}
              </Text>
              {r.note ? (
                <Text style={{ color: SOFT, marginTop: 6, fontSize: 13, lineHeight: 19 }}>{r.note}</Text>
              ) : null}
              <Text style={{ color: GREEN, marginTop: 10, fontWeight: '700', fontSize: 13 }}>
                {done ? 'TAKE ANOTHER' : 'TAKE A PHOTO'}
              </Text>
            </Pressable>
          );
        })}

      {/* --------------------------------------------------------- submit */}
      <Pressable
        onPress={() => void send()}
        disabled={saving || !ready?.canSubmit}
        style={{
          backgroundColor: ready?.canSubmit ? ORANGE : '#c9c6b8',
          padding: 18, marginTop: 30,
        }}
      >
        <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '800', letterSpacing: 1.2 }}>
          {ready?.canSubmit ? 'SEND IT TO MUSUWO' : 'NOT READY YET'}
        </Text>
      </Pressable>

      <Text style={{ color: SOFT, fontSize: 13, marginTop: 12, lineHeight: 19 }}>
        {ready?.canSubmit
          ? 'A person at Musuwo reads every application. Sending it does not put you online — approval does.'
          : `Still needed: ${(ready?.missing ?? []).map((m) => m.label).join(', ')}.`}
      </Text>
    </ScrollView>
  );
}
