/** Spring Initializr'da bulunmayan, pom.xml / build.gradle'a doğrudan eklenen kütüphaneler */
export interface LibraryDef {
  id: string;
  label: string;
  description: string;
  groupId: string;
  artifactId: string;
  /** Sürüm Maven Central'dan (en son kararlı sürüm) okunur */
}

export const LIBRARIES: LibraryDef[] = [
  {
    id: 'springdoc',
    label: 'SpringDoc OpenAPI',
    description: 'Swagger UI ve OpenAPI dokümanı (/swagger-ui.html)',
    groupId: 'org.springdoc',
    artifactId: 'springdoc-openapi-starter-webmvc-ui',
  },
];

export function findLibrary(id: string): LibraryDef {
  const lib = LIBRARIES.find((l) => l.id === id);
  if (!lib) throw new Error(`Bilinmeyen kütüphane: ${id}`);
  return lib;
}
