/**
 * Normalizes a venue name by trimming, collapsing spaces, and title-casing.
 * Mirrors the SQL function `normalize_venue_name`.
 */
export function normalizeVenueName(name: string | null | undefined): string | null {
    if (!name) return null;

    let cleaned = name;
    // Replace " | " style separators with a space
    cleaned = cleaned.replace(/\s*\|\s*/g, ' ');
    // Collapse double spaces
    cleaned = cleaned.replace(/\s+/g, ' ');
    // Trim
    cleaned = cleaned.trim();

    // Title Case (simple implementation)
    // Note: JS doesn't have a built-in title case that matches Postgres initcap exactly, 
    // but this is a reasonable approximation for display purposes.
    cleaned = cleaned.replace(/\w\S*/g, (txt) => {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });

    return cleaned;
}

/**
 * Generates a friendly display name for a venue.
 * Mirrors the SQL function `friendly_venue_name`.
 */
export function friendlyVenueName(canonicalName: string | null | undefined): string | null {
    const cleaned = normalizeVenueName(canonicalName);

    if (!cleaned) return null;

    // "Pickleball Courts Mitchell Park" -> "Mitchell Park Pickleball Courts"
    const pickleballPrefix = "Pickleball Courts ";
    if (cleaned.toLowerCase().startsWith(pickleballPrefix.toLowerCase())) {
        const suffix = cleaned.substring(pickleballPrefix.length);
        return `${suffix} Pickleball Courts`;
    }

    return cleaned;
}
