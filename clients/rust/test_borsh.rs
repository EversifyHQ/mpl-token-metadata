#[cfg(test)]
mod tests {
    use borsh::{BorshDeserialize, BorshSerialize};

    #[derive(BorshSerialize, BorshDeserialize)]
    struct TestStruct {
        value: u32,
    }

    #[test]
    fn test_borsh_functionality() {
        let test = TestStruct { value: 42 };
        let serialized = test.try_to_vec().unwrap();
        println!("Serialized: {:?}", serialized);
        
        let deserialized: TestStruct = TestStruct::try_from_slice(&serialized).unwrap();
        assert_eq!(deserialized.value, 42);
    }
}