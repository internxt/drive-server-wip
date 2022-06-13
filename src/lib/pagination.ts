export class Pagination {
  static calculatePagination(page: number, perPage: number) {
    const offset = (page - 1) * perPage;
    const limit = perPage;

    return { offset, limit };
  }
}
