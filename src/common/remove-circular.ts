export function removeCircular(object: any, references: any[] = []): any {
  if (typeof object !== 'object' || !object) {
    return object;
  }
  // If the object defines its own toJSON, prefer that.
  if ('toJSON' in object && typeof object.toJSON === 'function') {
    return object.toJSON();
  }
  if (references.includes(object)) {
    return '[Circular]';
  } else {
    references.push(object);
  }
  const returnObject: any = Array.isArray(object)
    ? Array.from({ length: object.length })
    : {};
  for (const key in object) {
    returnObject[key] = references.includes(object[key])
      ? '[Circular]'
      : removeCircular(object[key], references);
  }
  return returnObject;
}
