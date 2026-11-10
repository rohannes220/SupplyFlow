export function createUserService(userModel) {
  return {
    listUsers() {
      return userModel.listPublic();
    },
  };
}
