export class Pagination {
  static calculatePagination(page: number, perPage: number) {
    const offset = page * perPage;
    const limit = perPage;

    return { offset, limit };
  }
}
