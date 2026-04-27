export const generateSlug = async (client, title) => {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");

  let slug = base;
  let i = 1;

  while (true) {
    const { rowCount } = await client.query(
      "SELECT 1 FROM products WHERE slug=$1",
      [slug]
    );
    if (!rowCount) break;

    slug = `${base}-${i++}`;
  }

  return slug;
};