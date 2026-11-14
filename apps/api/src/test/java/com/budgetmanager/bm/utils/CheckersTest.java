package com.budgetmanager.bm.utils;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

class CheckersTest {

  @ParameterizedTest
  @ValueSource(
      strings = {
        "Abcdef1!",
        "Correct Horse Battery 9",
        "Senha#Forte2026",
        "Ação-Válida1",
        "Pass_word1",
        "Aa1~aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      })
  void acceptsStrongPasswordsWithAnySymbol(String password) {
    assertThat(Checkers.isPasswordCorrect(password)).isTrue();
  }

  @ParameterizedTest
  @NullSource
  @ValueSource(
      strings = {
        "Ab1!",
        "abcdefg1!",
        "ABCDEFG1!",
        "Abcdefgh!",
        "Abcdefgh1",
        "Aa1~aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      })
  void rejectsWeakOrTooLongPasswords(String password) {
    assertThat(Checkers.isPasswordCorrect(password)).isFalse();
  }
}
