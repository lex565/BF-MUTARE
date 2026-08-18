import { API_BASE, mobileApi } from './mobileApi';

/**
 * Registering a business from the phone, for real this time.
 *
 * WHAT THIS REPLACES. The app's business application was three screens ending
 * in `Alert.alert('Preview submitted')`. It wrote nothing. Somebody who filled
 * it in believed they had applied, nothing reached the review queue, and
 * neither side knew - they assumed Musuwo was ignoring them, and Musuwo never
 * knew they existed.
 *
 * Every call here goes to the same server functions the website uses, so the
 * rules cannot drift apart: the same requirements per provider type, the same
 * completeness gate, the same private bucket for documents.
 */

export type ProviderType =
  | 'INDIVIDUAL_SELLER'
  | 'INFORMAL_BUSINESS'
  | 'REGISTERED_BUSINESS'
  | 'SERVICE_PROVIDER'
  | 'ACCOMMODATION_PROVIDER';

export const PROVIDER_TYPES: { value: ProviderType; label: string; blurb: string }[] = [
  { value: 'INDIVIDUAL_SELLER', label: 'Just me',
    blurb: 'You sell on your own, in your own name. Cooking, baking, buying and reselling, crafts.' },
  { value: 'INFORMAL_BUSINESS', label: 'A small business, not registered',
    blurb: 'A real business with a name and maybe staff, but no company papers. This is normal and welcome.' },
  { value: 'REGISTERED_BUSINESS', label: 'A registered company',
    blurb: 'You have a certificate of incorporation or registration.' },
  { value: 'SERVICE_PROVIDER', label: 'I provide a service',
    blurb: 'Tutoring, plumbing, hair, repairs, transport.' },
  { value: 'ACCOMMODATION_PROVIDER', label: 'I have rooms to let',
    blurb: 'A boarding house, lodge, student rooms or a place to stay.' },
];

export type Requirement = {
  requirement: string;
  label: string;
  note: string | null;
  isMandatory: boolean;
  met: boolean;
};

export type Readiness = {
  providerType: ProviderType | null;
  requirements: Requirement[];
  missing: Requirement[];
  canSubmit: boolean;
};

export type ApplicationState = {
  application: Record<string, string | null> & { id: string; status: string } | null;
  readiness: Readiness | null;
  documents: string[];
  addressEvidence: { code: string; label: string; note: string | null }[];
};

export const getApplication = (token: string) =>
  mobileApi<ApplicationState>('/api/mobile/applications', token);

export const startApplication = (token: string, providerType: ProviderType) =>
  mobileApi<{ applicationId: string; status: string }>('/api/mobile/applications', token, {
    method: 'POST',
    body: JSON.stringify({ action: 'start', providerType }),
  });

export const saveApplication = (
  token: string,
  applicationId: string,
  fields: Record<string, string | null>,
) =>
  mobileApi<{ saved: boolean; readiness: Readiness }>('/api/mobile/applications', token, {
    method: 'POST',
    body: JSON.stringify({ action: 'save', applicationId, fields }),
  });

export const submitApplication = (token: string, applicationId: string) =>
  mobileApi<{ submitted: boolean }>('/api/mobile/applications', token, {
    method: 'POST',
    body: JSON.stringify({ action: 'submit', applicationId }),
  });

/**
 * NO IMAGE LIBRARY IS IMPORTED HERE, AND THAT IS DELIBERATE.
 *
 * The obvious way to shrink a 4MB camera photo is expo-image-manipulator. It
 * is a NATIVE module, so adding it means every tester must download and
 * install a new APK before any of this works - `eas update` cannot ship native
 * code. Everything else in this change is JavaScript and reaches existing
 * installs over the air within minutes.
 *
 * expo-image-picker is already in the binary and already compresses at
 * capture: `quality: 0.6` on the picker call gives a few hundred KB, which is
 * far more than enough to read an ID number from. See ASK_FOR_PHOTO below.
 *
 * The trade is stated rather than hidden: pictures are compressed at capture
 * rather than resized afterwards, so a very large sensor may still produce a
 * bigger file than the web path does. The 8MB server limit covers it.
 */

/** Pass these to launchCameraAsync / launchImageLibraryAsync. */
export const PHOTO_OPTIONS = {
  quality: 0.6,
  allowsEditing: false,
  exif: false,
} as const;

/**
 * Send a document.
 *
 * Multipart rather than base64 in JSON: base64 inflates the payload by a third
 * for no benefit, and the person is paying for those bytes.
 *
 * `mobileApi` is not used here because it forces a JSON content type, and
 * setting Content-Type by hand on multipart strips the boundary that React
 * Native generates - a mistake that produces an empty upload with no error.
 */
export async function uploadDocument(params: {
  token: string;
  applicationId: string;
  kind: string;
  uri: string;
}): Promise<void> {
  const { uri } = params;

  const form = new FormData();
  form.append('applicationId', params.applicationId);
  form.append('kind', params.kind);
  form.append('file', {
    uri,
    name: `${params.kind.toLowerCase()}.jpg`,
    type: 'image/jpeg',
  } as unknown as Blob);

  const response = await fetch(`${API_BASE}/api/mobile/applications/documents`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${params.token}` },
    body: form,
  });

  const body = (await response.json()) as
    | { data: unknown }
    | { error: { message: string } };

  if (!response.ok || 'error' in body) {
    throw new Error(
      'error' in body ? body.error.message : 'That did not upload. Try again.',
    );
  }
}

/** Which upload satisfies which requirement. Mirrors the server. */
export const DOCUMENT_FOR: Record<string, string> = {
  id_document: 'ID_DOCUMENT',
  id_selfie: 'ID_SELFIE',
  address_evidence: 'PROOF_OF_ADDRESS',
  registration_document: 'BUSINESS_REGISTRATION',
  premises_photo: 'PREMISES_PHOTO',
  property_photos: 'PROPERTY_PHOTO',
  logo: 'LOGO',
};
